import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const activityRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/activity ────────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const { limit = 50, before } = request.query as { limit?: number; before?: string };
    const safeLimit = Math.min(Number(limit), 100);

    const activities = await prisma.activity.findMany({
      where: before ? { createdAt: { lt: new Date(before) } } : {},
      include: {
        country: { select: { id: true, name: true, flag: true, isoCode: true } },
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    // Fetch related countries
    const enriched = await Promise.all(
      activities.map(async (activity) => {
        let relatedCountry = null;
        if (activity.relatedCountryId) {
          relatedCountry = await prisma.country.findUnique({
            where: { id: activity.relatedCountryId },
            select: { id: true, name: true, flag: true, isoCode: true },
          });
        }
        return { ...activity, relatedCountry };
      })
    );

    return reply.send({ success: true, data: { items: enriched } });
  });

  // ─── GET /api/activity/country/:id ───────────────────────────────────────
  app.get('/country/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = 20 } = request.query as { limit?: number };

    const country = await prisma.country.findFirst({
      where: { OR: [{ id }, { isoCode: id.toUpperCase() }] },
      select: { id: true },
    });

    if (!country) {
      return reply.code(404).send({ success: false, error: 'Country not found' });
    }

    const activities = await prisma.activity.findMany({
      where: { countryId: country.id },
      include: {
        country: { select: { id: true, name: true, flag: true, isoCode: true } },
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 50),
    });

    return reply.send({ success: true, data: { items: activities } });
  });
};
