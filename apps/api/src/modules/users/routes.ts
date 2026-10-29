import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { UpdateProfileSchema } from '@worldbid/validation';

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/users/:id ───────────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findFirst({
      where: { OR: [{ id }, { username: id }] },
      select: {
        id: true, username: true, avatar: true, countryCode: true, createdAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ success: false, error: 'User not found' });
    }

    // Get user stats
    const [totalSupport, bidsCount, supportedCountries] = await Promise.all([
      prisma.bid.aggregate({
        where: { userId: user.id, status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      prisma.bid.count({ where: { userId: user.id, status: 'CONFIRMED' } }),
      prisma.countrySupport.findMany({
        where: { userId: user.id },
        include: {
          country: {
            select: { id: true, name: true, flag: true, isoCode: true, rank: true, totalSupport: true, currentBid: true, supporterCount: true },
          },
        },
        orderBy: { totalAmount: 'desc' },
        take: 10,
      }),
    ]);

    const topCountry = supportedCountries[0]
      ? {
          name: supportedCountries[0].country.name,
          flag: supportedCountries[0].country.flag,
          isoCode: supportedCountries[0].country.isoCode,
          totalAmount: supportedCountries[0].totalAmount,
        }
      : null;

    // Recent bids
    const recentBids = await prisma.bid.findMany({
      where: { userId: user.id, status: 'CONFIRMED' },
      include: { country: { select: { name: true, flag: true, isoCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return reply.send({
      success: true,
      data: {
        user: {
          ...user,
          totalSupport: totalSupport._sum.amount ?? 0,
          countriesSupported: supportedCountries.length,
          bidsCount,
          topCountry,
          recentBids: recentBids.map((b) => ({
            id: b.id,
            country: b.country,
            amount: b.amount,
            createdAt: b.createdAt.toISOString(),
          })),
          supportedCountries: supportedCountries.map((s) => ({
            country: s.country,
            totalAmount: s.totalAmount,
            bidsCount: s.bidsCount,
          })),
        },
      },
    });
  });

  // ─── PATCH /api/users/me ──────────────────────────────────────────────────
  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const body = UpdateProfileSchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ success: false, error: 'Validation failed', details: body.error.flatten() });
    }

    const { username, avatar, countryCode } = body.data;

    // Check username uniqueness
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: auth.user.id } },
      });
      if (existing) {
        return reply.code(409).send({ success: false, error: 'Username already taken', code: 'DUPLICATE' });
      }
    }

    const updateData: { username?: string; avatar?: string | null; countryCode?: string | null } = {};
    if (username !== undefined) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar ?? null;
    if (countryCode !== undefined) updateData.countryCode = countryCode ?? null;

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: updateData,
      select: { id: true, email: true, username: true, avatar: true, countryCode: true, role: true, updatedAt: true },
    });

    return reply.send({ success: true, data: { user } });
  });

  // ─── GET /api/users/:id/notifications ────────────────────────────────────
  app.get('/me/notifications', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.notification.count({ where: { userId: auth.user.id } }),
      prisma.notification.count({ where: { userId: auth.user.id, isRead: false } }),
    ]);

    return reply.send({ success: true, data: { items: notifications, total, unread } });
  });

  // ─── POST /api/users/me/notifications/read-all ───────────────────────────
  app.post('/me/notifications/read-all', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, isRead: false },
      data: { isRead: true },
    });
    return reply.send({ success: true, data: { message: 'All notifications marked as read' } });
  });
};
