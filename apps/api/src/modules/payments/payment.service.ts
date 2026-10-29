import { prisma } from '../../lib/prisma.js';
import { nanoid } from 'nanoid';
import { env } from '../../config/env.js';

// ─── Payment Service (Provider-Agnostic) ─────────────────────────────────────

interface CreatePaymentInput {
  userId: string;
  amount: number;
  currency: string;
  provider?: string;
}

interface PaymentRecord {
  id: string;
  provider: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  status: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
  const provider = input.provider ?? env.PAYMENT_PROVIDER;

  // Create pending payment record
  const payment = await prisma.payment.create({
    data: {
      userId: input.userId,
      bidId: 'PENDING', // Will be updated after bid creation - use placeholder
      provider,
      amount: input.amount,
      currency: input.currency,
      status: 'PENDING',
      metadata: { createdAt: new Date().toISOString() },
    },
  });

  // Execute payment with the configured provider
  switch (provider) {
    case 'mock':
      return await processMockPayment(payment.id, input.amount);
    case 'stripe':
      return await processStripePayment(payment.id, input);
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

export async function verifyPayment(paymentId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  return payment?.status === 'COMPLETED';
}

export async function refundPayment(paymentId: string, reason: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('Payment not found');

  switch (payment.provider) {
    case 'mock':
      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      break;
    case 'stripe':
      // Stripe refund logic would go here
      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      break;
  }
}

// ─── Mock Payment Provider ────────────────────────────────────────────────────
// All amounts are immediately approved.
// Used in DEV mode so the complete bid flow can be tested.

async function processMockPayment(paymentId: string, amount: number): Promise<PaymentRecord> {
  const providerPaymentId = `mock_${nanoid(16)}`;

  // Simulate async processing
  await new Promise((resolve) => setTimeout(resolve, 50));

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'COMPLETED',
      providerPaymentId,
      metadata: {
        provider: 'mock',
        amount,
        processedAt: new Date().toISOString(),
        note: 'DEV MODE — Not a real payment',
      },
    },
  });

  return payment;
}

// ─── Stripe Payment Provider ──────────────────────────────────────────────────

async function processStripePayment(paymentId: string, input: CreatePaymentInput): Promise<PaymentRecord> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not configured');
  }

  // Dynamic import to avoid loading Stripe in mock mode
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100), // cents
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { userId: input.userId, paymentId },
    });

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        providerPaymentId: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
        metadata: { stripeStatus: paymentIntent.status, clientSecret: paymentIntent.client_secret },
      },
    });

    return payment;
  } catch (err) {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
    throw err;
  }
}
