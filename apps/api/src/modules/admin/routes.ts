import type { FastifyPluginAsync } from 'fastify';
import { authenticate, requireAdmin, requireSuperAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { refundPayment } from '../payments/payment.service.js';
import { PaginationSchema } from '@worldbid/validation';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // All admin routes require authentication + admin role
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  // ─── GET /api/admin/users ─────────────────────────────────────────────────
  app.get('/users', async (request, reply) => {
    const query = PaginationSchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 20;
    const { search } = request.query as { search?: string };

    const where = search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { username: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, username: true, role: true, isFrozen: true, createdAt: true, countryCode: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({ success: true, data: { items: users, total, page, pageSize } });
  });

  // ─── POST /api/admin/users/:id/freeze ────────────────────────────────────
  app.post('/users/:id/freeze', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    const user = await prisma.user.update({
      where: { id },
      data: { isFrozen: true, freezeReason: reason },
    });

    app.log.warn({ userId: id, reason }, 'ADMIN_USER_FROZEN');
    return reply.send({ success: true, data: { user: { id: user.id, isFrozen: user.isFrozen } } });
  });

  // ─── POST /api/admin/users/:id/unfreeze ──────────────────────────────────
  app.post('/users/:id/unfreeze', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.update({
      where: { id },
      data: { isFrozen: false, freezeReason: null },
    });

    return reply.send({ success: true, data: { user: { id: user.id, isFrozen: user.isFrozen } } });
  });

  // ─── GET /api/admin/bids ──────────────────────────────────────────────────
  app.get('/bids', async (request, reply) => {
    const query = PaginationSchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 20;

    const [bids, total] = await Promise.all([
      prisma.bid.findMany({
        include: {
          user: { select: { id: true, username: true, email: true } },
          country: { select: { id: true, name: true, flag: true, isoCode: true } },
          payment: { select: { id: true, status: true, provider: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bid.count(),
    ]);

    return reply.send({ success: true, data: { items: bids, total, page, pageSize } });
  });

  // ─── POST /api/admin/bids/:id/refund ─────────────────────────────────────
  app.post('/bids/:id/refund', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    const bid = await prisma.bid.findUnique({ where: { id }, include: { payment: true } });
    if (!bid) {
      return reply.code(404).send({ success: false, error: 'Bid not found' });
    }

    if (bid.payment) {
      await refundPayment(bid.payment.id, reason);
    }

    await prisma.bid.update({ where: { id }, data: { status: 'REFUNDED' } });

    app.log.warn({ bidId: id, reason }, 'ADMIN_BID_REFUNDED');
    return reply.send({ success: true, data: { message: 'Bid refunded successfully' } });
  });

  // ─── GET /api/admin/countries ─────────────────────────────────────────────
  app.get('/countries', async (request, reply) => {
    const query = PaginationSchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 50;

    const [countries, total] = await Promise.all([
      prisma.country.findMany({
        orderBy: { rank: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.country.count(),
    ]);

    return reply.send({ success: true, data: { items: countries, total, page, pageSize } });
  });

  // ─── PATCH /api/admin/countries/:id ──────────────────────────────────────
  app.patch('/countries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as { isActive?: boolean; description?: string };

    const country = await prisma.country.update({ where: { id }, data });
    return reply.send({ success: true, data: { country } });
  });

  // ─── GET /api/admin/analytics ─────────────────────────────────────────────
  app.get('/analytics', async (_request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setDate(week.getDate() - 7);

    const [totalBids, totalUsers, totalRevenue, revenueToday, newUsersToday, topCountries] = await Promise.all([
      prisma.bid.count({ where: { status: 'CONFIRMED' } }),
      prisma.user.count(),
      prisma.bid.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.bid.aggregate({ where: { status: 'CONFIRMED', createdAt: { gte: today } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.country.findMany({
        where: { rank: { lte: 10 } },
        orderBy: { rank: 'asc' },
        select: { name: true, flag: true, isoCode: true, rank: true, totalSupport: true, supporterCount: true },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        totalBids,
        totalUsers,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        revenueToday: revenueToday._sum.amount ?? 0,
        newUsersToday,
        topCountries,
      },
    });
  });

  // ─── GET /api/admin/system ────────────────────────────────────────────────
  app.get('/system', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
    });
  });
};
