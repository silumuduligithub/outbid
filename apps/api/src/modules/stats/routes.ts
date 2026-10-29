import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

export const statsRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/stats ───────────────────────────────────────────────────────
  app.get('/', async (_request, reply) => {
    const cacheKey = 'global:stats';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCountries,
      totalSupportResult,
      totalSupporters,
      bidsToday,
      topCountry,
    ] = await Promise.all([
      prisma.country.count({ where: { isActive: true } }),
      prisma.bid.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.user.count(),
      prisma.bid.count({ where: { status: 'CONFIRMED', createdAt: { gte: today } } }),
      prisma.country.findFirst({
        where: { rank: 1, isActive: true },
        select: { name: true, flag: true, isoCode: true, totalSupport: true },
      }),
    ]);

    // Live bids = bids in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const liveBids = await prisma.bid.count({
      where: { status: 'CONFIRMED', createdAt: { gte: fiveMinAgo } },
    });

    const stats = {
      totalCountries,
      totalSupport: totalSupportResult._sum.amount ?? 0,
      totalSupporters,
      bidsToday,
      liveBids,
      topCountry: topCountry
        ? {
            name: topCountry.name,
            flag: topCountry.flag,
            isoCode: topCountry.isoCode,
            totalSupport: topCountry.totalSupport,
          }
        : null,
    };

    await redis.setex(cacheKey, 10, JSON.stringify(stats));

    return reply.send({ success: true, data: stats });
  });
};
