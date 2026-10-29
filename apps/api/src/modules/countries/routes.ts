import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { COUNTRY_CACHE_TTL } from '@worldbid/config';
import { CountrySearchSchema, PaginationSchema } from '@worldbid/validation';

const COUNTRY_SELECT = {
  id: true,
  name: true,
  officialName: true,
  isoCode: true,
  iso3Code: true,
  flag: true,
  continent: true,
  currency: true,
  description: true,
  totalSupport: true,
  currentBid: true,
  rank: true,
  previousRank: true,
  supporterCount: true,
  createdAt: true,
  updatedAt: true,
};

export const countriesRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/countries ───────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const query = PaginationSchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 50;

    const [countries, total] = await Promise.all([
      prisma.country.findMany({
        where: { isActive: true },
        select: COUNTRY_SELECT,
        orderBy: { rank: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.country.count({ where: { isActive: true } }),
    ]);

    return reply.send({
      success: true,
      data: {
        items: countries,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    });
  });

  // ─── GET /api/countries/search ────────────────────────────────────────────
  app.get('/search', async (request, reply) => {
    const query = CountrySearchSchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ success: false, error: 'Search query required' });
    }

    const { q, limit } = query.data;
    const search = q.toLowerCase().trim();

    const countries = await prisma.country.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { officialName: { contains: search, mode: 'insensitive' } },
          { isoCode: { equals: search.toUpperCase() } },
          { iso3Code: { equals: search.toUpperCase() } },
        ],
      },
      select: COUNTRY_SELECT,
      orderBy: { totalSupport: 'desc' },
      take: limit,
    });

    return reply.send({ success: true, data: { items: countries } });
  });

  // ─── GET /api/countries/:id ───────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Try cache first
    const cacheKey = `country:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: { country: JSON.parse(cached) } });
    }

    // Lookup by UUID or ISO code
    const isUuid = /^[0-9a-f-]{36}$/i.test(id);

    const country = await prisma.country.findFirst({
      where: {
        isActive: true,
        ...(isUuid ? { id } : { OR: [{ isoCode: id.toUpperCase() }, { iso3Code: id.toUpperCase() }, { name: { equals: id, mode: 'insensitive' } }] }),
      },
      select: COUNTRY_SELECT,
    });

    if (!country) {
      return reply.code(404).send({ success: false, error: 'Country not found', code: 'NOT_FOUND' });
    }

    await redis.setex(cacheKey, COUNTRY_CACHE_TTL, JSON.stringify(country));

    return reply.send({ success: true, data: { country } });
  });

  // ─── GET /api/countries/:id/history ──────────────────────────────────────
  app.get('/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { period = '7d' } = request.query as { period?: string };

    const periodMap: Record<string, number> = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      all: 365,
    };

    const days = periodMap[period] ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const country = await prisma.country.findFirst({
      where: { OR: [{ id }, { isoCode: id.toUpperCase() }], isActive: true },
      select: { id: true },
    });

    if (!country) {
      return reply.code(404).send({ success: false, error: 'Country not found' });
    }

    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: { countryId: country.id, snapshotAt: { gte: since } },
      orderBy: { snapshotAt: 'asc' },
      select: { rank: true, totalSupport: true, snapshotAt: true },
    });

    return reply.send({ success: true, data: { history: snapshots } });
  });

  // ─── GET /api/countries/:id/supporters ───────────────────────────────────
  app.get('/:id/supporters', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = PaginationSchema.safeParse(request.query);
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 20;

    const country = await prisma.country.findFirst({
      where: { OR: [{ id }, { isoCode: id.toUpperCase() }], isActive: true },
      select: { id: true },
    });

    if (!country) {
      return reply.code(404).send({ success: false, error: 'Country not found' });
    }

    const [supporters, total] = await Promise.all([
      prisma.countrySupport.findMany({
        where: { countryId: country.id },
        include: { user: { select: { id: true, username: true, avatar: true } } },
        orderBy: { totalAmount: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.countrySupport.count({ where: { countryId: country.id } }),
    ]);

    return reply.send({
      success: true,
      data: {
        items: supporters.map((s) => ({
          user: s.user,
          totalAmount: s.totalAmount,
          bidsCount: s.bidsCount,
          lastBidAt: s.lastBidAt,
        })),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    });
  });

  // ─── GET /api/countries/:id/min-bid ──────────────────────────────────────
  app.get('/:id/min-bid', async (request, reply) => {
    const { id } = request.params as { id: string };

    const country = await prisma.country.findFirst({
      where: { OR: [{ id }, { isoCode: id.toUpperCase() }], isActive: true },
    });

    if (!country) {
      return reply.code(404).send({ success: false, error: 'Country not found' });
    }

    // Find the country immediately above in rank
    let targetCountry = null;
    if (country.rank > 1) {
      targetCountry = await prisma.country.findFirst({
        where: { rank: country.rank - 1, isActive: true },
      });
    }

    const minimumNextBid = targetCountry ? targetCountry.currentBid + 1 : country.currentBid + 1;

    return reply.send({
      success: true,
      data: {
        countryId: country.id,
        countryName: country.name,
        currentBid: country.currentBid,
        currentRank: country.rank,
        minimumNextBid,
        targetCountry: targetCountry
          ? {
              id: targetCountry.id,
              name: targetCountry.name,
              flag: targetCountry.flag,
              currentBid: targetCountry.currentBid,
              rank: targetCountry.rank,
            }
          : null,
      },
    });
  });
};
