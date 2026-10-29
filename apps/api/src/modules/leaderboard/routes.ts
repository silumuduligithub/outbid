import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { LEADERBOARD_CACHE_TTL } from '@worldbid/config';
import { LeaderboardQuerySchema } from '@worldbid/validation';

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/leaderboard ─────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const query = LeaderboardQuerySchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 50;
    const rawContinent = query.success ? query.data.continent : undefined;
    const continent = rawContinent && rawContinent !== 'ALL'
      ? rawContinent.toUpperCase().replace(/\s+/g, '_')
      : undefined;

    // Cache key includes page, pageSize, continent
    const cacheKey = `leaderboard:${page}:${pageSize}:${continent ?? 'all'}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const where = {
      isActive: true,
      ...(continent ? { continent: continent as any } : {}),
    };

    const [countries, total] = await Promise.all([
      prisma.country.findMany({
        where,
        orderBy: [{ rank: 'asc' }, { totalSupport: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          officialName: true,
          isoCode: true,
          iso3Code: true,
          flag: true,
          continent: true,
          currency: true,
          totalSupport: true,
          currentBid: true,
          rank: true,
          previousRank: true,
          supporterCount: true,
          updatedAt: true,
        },
      }),
      prisma.country.count({ where }),
    ]);

    const entries = countries.map((country) => ({
      rank: country.rank,
      previousRank: country.previousRank,
      rankChange: country.previousRank ? country.previousRank - country.rank : 0,
      country,
    }));

    const result = {
      entries,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      updatedAt: new Date().toISOString(),
    };

    await redis.setex(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(result));

    return reply.send({ success: true, data: result });
  });

  // ─── GET /api/leaderboard/top ─────────────────────────────────────────────
  app.get('/top', async (request, reply) => {
    const { limit = 10 } = request.query as { limit?: number };
    const safeLimit = Math.min(Number(limit), 50);

    const cacheKey = `leaderboard:top:${safeLimit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const countries = await prisma.country.findMany({
      where: { isActive: true, rank: { gt: 0 } },
      orderBy: { rank: 'asc' },
      take: safeLimit,
      select: {
        id: true,
        name: true,
        isoCode: true,
        flag: true,
        continent: true,
        totalSupport: true,
        currentBid: true,
        rank: true,
        previousRank: true,
        supporterCount: true,
      },
    });

    const entries = countries.map((c) => ({
      rank: c.rank,
      previousRank: c.previousRank,
      rankChange: c.previousRank ? c.previousRank - c.rank : 0,
      country: c,
    }));

    await redis.setex(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(entries));

    return reply.send({ success: true, data: entries });
  });

  // ─── GET /api/leaderboard/history ────────────────────────────────────────
  app.get('/history', async (request, reply) => {
    const { period = '7d', countryId } = request.query as { period?: string; countryId?: string };

    const periodMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, all: 365 };
    const days = periodMap[period] ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: {
        snapshotAt: { gte: since },
        ...(countryId ? { countryId } : {}),
      },
      include: {
        country: { select: { id: true, name: true, flag: true, isoCode: true } },
      },
      orderBy: { snapshotAt: 'desc' },
      take: 500,
    });

    return reply.send({ success: true, data: { snapshots } });
  });

  // ─── GET /api/leaderboard/movers ─────────────────────────────────────────
  app.get('/movers', async (request, reply) => {
    const { direction = 'up', limit = 5 } = request.query as { direction?: string; limit?: number };
    const safeLimit = Math.min(Number(limit), 20);

    const countries = await prisma.country.findMany({
      where: {
        isActive: true,
        previousRank: { not: null },
        rank: { gt: 0 },
      },
      select: {
        id: true, name: true, isoCode: true, flag: true,
        totalSupport: true, rank: true, previousRank: true,
      },
      orderBy: direction === 'up'
        ? [{ rank: 'asc' }]
        : [{ rank: 'desc' }],
      take: safeLimit * 5, // Over-fetch, then filter
    });

    const movers = countries
      .map((c) => ({ ...c, rankChange: (c.previousRank ?? c.rank) - c.rank }))
      .filter((c) => direction === 'up' ? c.rankChange > 0 : c.rankChange < 0)
      .sort((a, b) => direction === 'up' ? b.rankChange - a.rankChange : a.rankChange - b.rankChange)
      .slice(0, safeLimit);

    return reply.send({ success: true, data: { movers } });
  });
};
