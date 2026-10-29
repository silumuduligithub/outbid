import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      reply.code(401).send({ success: false, error: 'Invalid token type', code: 'INVALID_TOKEN' });
      return;
    }

    // Verify user still exists and isn't frozen
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isFrozen: true },
    });

    if (!user) {
      reply.code(401).send({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    if (user.isFrozen) {
      reply.code(403).send({ success: false, error: 'Account is frozen', code: 'ACCOUNT_FROZEN' });
      return;
    }

    (request as AuthenticatedRequest).user = user;
  } catch {
    reply.code(401).send({ success: false, error: 'Invalid or expired token', code: 'TOKEN_EXPIRED' });
  }
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      reply.code(403).send({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
  };
}

export const requireAdmin = requireRole(['ADMIN', 'SUPER_ADMIN']);
export const requireSuperAdmin = requireRole(['SUPER_ADMIN']);
