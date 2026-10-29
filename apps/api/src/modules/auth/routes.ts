import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../lib/jwt.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@worldbid/validation';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { authenticate } from '../../middleware/auth.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ─── POST /api/auth/register ──────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const body = RegisterSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: 'Validation failed', details: body.error.flatten() });
    }

    const { email, password, username, countryCode } = body.data;

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return reply.code(409).send({ success: false, error: `${field} already in use`, code: 'DUPLICATE' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, passwordHash, countryCode: countryCode ?? null, role: 'USER' },
      select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, createdAt: true, updatedAt: true },
    });

    const tokens = generateTokens(user);

    app.log.info({ userId: user.id }, 'USER_CREATED');

    return reply.code(201).send({ success: true, data: { user, tokens } });
  });

  // ─── POST /api/auth/login ─────────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: 'Validation failed', details: body.error.flatten() });
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, passwordHash: true, isFrozen: true, createdAt: true, updatedAt: true },
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    if (user.isFrozen) {
      return reply.code(403).send({ success: false, error: 'Account is frozen', code: 'ACCOUNT_FROZEN' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return reply.code(401).send({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    const { passwordHash: _, isFrozen: __, ...safeUser } = user;
    const tokens = generateTokens(safeUser);

    return reply.send({ success: true, data: { user: safeUser, tokens } });
  });

  // ─── POST /api/auth/refresh ───────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const body = RefreshTokenSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: 'Refresh token required' });
    }

    try {
      const payload = verifyRefreshToken(body.data.refreshToken);

      if (payload.type !== 'refresh') {
        return reply.code(401).send({ success: false, error: 'Invalid token type' });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isFrozen: true },
      });

      if (!user || user.isFrozen) {
        return reply.code(401).send({ success: false, error: 'User not found or frozen' });
      }

      const tokens = generateTokens(user);
      return reply.send({ success: true, data: { tokens } });
    } catch {
      return reply.code(401).send({ success: false, error: 'Invalid or expired refresh token' });
    }
  });

  // ─── POST /api/auth/google ────────────────────────────────────────────────
  app.post('/google', async (request, reply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      return reply.code(501).send({ success: false, error: 'Google auth not configured' });
    }

    const { idToken } = request.body as { idToken: string };
    if (!idToken) {
      return reply.code(400).send({ success: false, error: 'Google ID token required' });
    }

    try {
      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const googlePayload = ticket.getPayload();
      if (!googlePayload?.email || !googlePayload.sub) {
        return reply.code(400).send({ success: false, error: 'Invalid Google token' });
      }

      let user = await prisma.user.findFirst({
        where: { OR: [{ googleId: googlePayload.sub }, { email: googlePayload.email }] },
        select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, createdAt: true, updatedAt: true },
      });

      if (!user) {
        const baseUsername = (googlePayload.email.split('@')[0] ?? 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
        const username = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;

        user = await prisma.user.create({
          data: {
            email: googlePayload.email,
            username,
            googleId: googlePayload.sub,
            avatar: googlePayload.picture ?? null,
            role: 'USER',
          },
          select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, createdAt: true, updatedAt: true },
        });

        app.log.info({ userId: user.id }, 'USER_CREATED');
      }

      const tokens = generateTokens(user);
      return reply.send({ success: true, data: { user, tokens } });
    } catch (err) {
      app.log.error(err, 'Google auth error');
      return reply.code(401).send({ success: false, error: 'Google authentication failed' });
    }
  });

  // ─── GET /api/auth/me ─────────────────────────────────────────────────────
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, createdAt: true, updatedAt: true },
    });

    return reply.send({ success: true, data: { user: fullUser } });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────────────
  app.post('/logout', async (_request, reply) => {
    // Client-side token deletion; server stateless
    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
  });
};
