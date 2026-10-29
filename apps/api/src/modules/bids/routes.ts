import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js';
import { CreateBidSchema } from '@worldbid/validation';
import { processBid, publishBidResult, BidError } from './bid.service.js';
import { createPayment, verifyPayment } from '../payments/payment.service.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export const bidsRoutes: FastifyPluginAsync = async (app) => {
  // ─── POST /api/bids ───────────────────────────────────────────────────────
  // Main bid endpoint: validates → payment → processes → publishes
  app.post(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;

      const body = CreateBidSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: body.error.flatten(),
        });
      }

      const { countryId, amount, currency, idempotencyKey } = body.data;

      try {
        // 1. Create payment (may be mock or real)
        const payment = await createPayment({
          userId: auth.user.id,
          amount,
          currency,
          provider: env.PAYMENT_PROVIDER,
        });

        // 2. Verify payment
        const verified = await verifyPayment(payment.id);
        if (!verified) {
          return reply.code(402).send({
            success: false,
            error: 'Payment verification failed. Your country has not moved.',
            code: 'PAYMENT_FAILED',
          });
        }

        // 3. Process bid (atomic transaction)
        const result = await processBid(auth.user.id, {
          countryId,
          amount,
          currency,
          idempotencyKey,
        });

        // 4. Link payment to bid
        await prisma.payment.update({
          where: { id: payment.id },
          data: { bidId: result.bid.id, status: 'COMPLETED' },
        });

        // 5. Publish real-time events (non-blocking)
        publishBidResult(result).catch((err) =>
          app.log.error(err, 'Failed to publish bid result')
        );

        app.log.info(
          { userId: auth.user.id, bidId: result.bid.id, amount, countryId },
          'BID_CREATED'
        );

        return reply.code(201).send({ success: true, data: result });
      } catch (err) {
        if (err instanceof BidError) {
          return reply.code(err.statusCode).send({
            success: false,
            error: err.message,
            code: err.code,
          });
        }

        app.log.error(err, 'BID_FAILED');
        return reply.code(500).send({
          success: false,
          error: 'Failed to process bid. Please try again.',
          code: 'BID_FAILED',
        });
      }
    }
  );

  // ─── GET /api/bids/my ─────────────────────────────────────────────────────
  app.get('/my', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };

    const [bids, total] = await Promise.all([
      prisma.bid.findMany({
        where: { userId: auth.user.id },
        include: {
          country: { select: { id: true, name: true, flag: true, isoCode: true, rank: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.bid.count({ where: { userId: auth.user.id } }),
    ]);

    return reply.send({
      success: true,
      data: {
        items: bids,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        hasMore: Number(page) * Number(pageSize) < total,
      },
    });
  });

  // ─── GET /api/bids/:id ────────────────────────────────────────────────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const bid = await prisma.bid.findUnique({
      where: { id },
      include: {
        country: { select: { id: true, name: true, flag: true, isoCode: true, rank: true } },
        payment: true,
      },
    });

    if (!bid) {
      return reply.code(404).send({ success: false, error: 'Bid not found' });
    }

    // Users can only see their own bids (admins can see all)
    if (bid.userId !== auth.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)) {
      return reply.code(403).send({ success: false, error: 'Forbidden' });
    }

    return reply.send({ success: true, data: { bid } });
  });
};
