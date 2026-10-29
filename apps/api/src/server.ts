import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { setupSocketIO } from './websocket/index.js';

// ─── Route imports ────────────────────────────────────────────────────────────
import { authRoutes } from './modules/auth/routes.js';
import { countriesRoutes } from './modules/countries/routes.js';
import { leaderboardRoutes } from './modules/leaderboard/routes.js';
import { bidsRoutes } from './modules/bids/routes.js';
import { paymentsRoutes } from './modules/payments/routes.js';
import { activityRoutes } from './modules/activity/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { statsRoutes } from './modules/stats/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: env.LOG_LEVEL,
            transport: { target: 'pino-pretty', options: { colorize: true } },
          }
        : {
            level: env.LOG_LEVEL,
          },
    trustProxy: true,
    disableRequestLogging: false,
  });

  // ─── Security ────────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis,
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for']?.toString() ?? request.ip;
    },
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });

  // ─── Swagger docs (dev only) ──────────────────────────────────────────────
  if (env.NODE_ENV === 'development') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'WorldBid API', version: '1.0.0', description: 'The Global Country Competition API' },
        servers: [{ url: `http://localhost:${env.PORT}` }],
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Countries', description: 'Country data' },
          { name: 'Leaderboard', description: 'Global rankings' },
          { name: 'Bids', description: 'Bid management' },
          { name: 'Payments', description: 'Payment processing' },
          { name: 'Activity', description: 'Live activity feed' },
          { name: 'Users', description: 'User profiles' },
          { name: 'Stats', description: 'Global statistics' },
          { name: 'Admin', description: 'Admin operations' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  }

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' };
    } catch (err) {
      return reply.status(503).send({ status: 'error', error: 'Service unavailable' });
    }
  });

  // ─── Register routes ──────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(countriesRoutes, { prefix: '/api/countries' });
  await app.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
  await app.register(bidsRoutes, { prefix: '/api/bids' });
  await app.register(paymentsRoutes, { prefix: '/api/payments' });
  await app.register(activityRoutes, { prefix: '/api/activity' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(statsRoutes, { prefix: '/api/stats' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
  });

  // ─── Error handler ────────────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      app.log.error({ err: error, req: request }, 'Server error');
    }

    reply.code(statusCode).send({
      success: false,
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      code: error.code ?? 'INTERNAL_ERROR',
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildApp();

    // ─── Attach Socket.IO to Fastify server ───────────────────────────────
    const io = new SocketIOServer(app.server, {
      cors: {
        origin: env.ALLOWED_ORIGINS.split(','),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Attach io to app for use in routes
    app.decorate('io', io);

    // Set up Socket.IO event handlers
    setupSocketIO(io);

    // ─── Start server ──────────────────────────────────────────────────────
    await app.ready();

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 WorldBid API running on http://0.0.0.0:${env.PORT}`);
    app.log.info(`📊 Swagger docs: http://localhost:${env.PORT}/docs`);
    app.log.info(`💚 Health check: http://localhost:${env.PORT}/health`);

    // ─── Graceful shutdown ─────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
