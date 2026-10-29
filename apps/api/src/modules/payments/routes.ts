import type { FastifyPluginAsync } from 'fastify';
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { createPayment } from './payment.service.js';
import { env } from '../../config/env.js';
import { createHmac } from 'crypto';

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/payments/providers ─────────────────────────────────────────
  app.get('/providers', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        provider: env.PAYMENT_PROVIDER,
        isDevMode: env.PAYMENT_PROVIDER === 'mock',
        devAmounts: env.PAYMENT_PROVIDER === 'mock' ? [10, 50, 100, 500, 1000, 5000] : null,
      },
    });
  });

  // ─── POST /api/payments/create ────────────────────────────────────────────
  app.post('/create', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const { amount, currency = 'USD' } = request.body as { amount: number; currency?: string };

    if (!amount || amount < 1) {
      return reply.code(400).send({ success: false, error: 'Invalid amount' });
    }

    const payment = await createPayment({
      userId: auth.user.id,
      amount,
      currency,
      provider: env.PAYMENT_PROVIDER,
    });

    return reply.code(201).send({ success: true, data: { payment } });
  });

  // ─── POST /api/payments/webhook ───────────────────────────────────────────
  // Stripe webhook handler
  app.post('/webhook', async (request, reply) => {
    if (env.PAYMENT_PROVIDER !== 'stripe' || !env.STRIPE_WEBHOOK_SECRET) {
      return reply.code(200).send({ received: true });
    }

    const signature = request.headers['stripe-signature'];
    if (!signature) {
      return reply.code(400).send({ success: false, error: 'Missing Stripe signature' });
    }

    // Verify webhook signature
    const body = JSON.stringify(request.body);
    const hmac = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET);
    hmac.update(body);
    const computedSig = hmac.digest('hex');

    if (computedSig !== signature) {
      app.log.warn('Invalid Stripe webhook signature');
      return reply.code(400).send({ success: false, error: 'Invalid signature' });
    }

    const event = request.body as { type: string; data: { object: { id: string; status: string } } };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await prisma.payment.updateMany({
          where: { providerPaymentId: paymentIntent.id },
          data: { status: 'COMPLETED' },
        });
        app.log.info({ paymentIntentId: paymentIntent.id }, 'PAYMENT_SUCCESS');
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await prisma.payment.updateMany({
          where: { providerPaymentId: paymentIntent.id },
          data: { status: 'FAILED' },
        });
        app.log.warn({ paymentIntentId: paymentIntent.id }, 'PAYMENT_FAILED');
        break;
      }
    }

    return reply.send({ received: true });
  });

  // ─── GET /api/payments/my ─────────────────────────────────────────────────
  app.get('/my', { preHandler: authenticate }, async (request, reply) => {
    const auth = request as AuthenticatedRequest;
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: {
          id: true,
          provider: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where: { userId: auth.user.id } }),
    ]);

    return reply.send({ success: true, data: { items: payments, total } });
  });
};
