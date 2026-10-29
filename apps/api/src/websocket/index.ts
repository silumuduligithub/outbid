import type { Server as SocketIOServer } from 'socket.io';
import { redisSub } from '../lib/redis.js';
import { WS_EVENTS, WS_ROOMS } from '@worldbid/config';
import { prisma } from '../lib/prisma.js';

export function setupSocketIO(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Client joins rooms ──────────────────────────────────────────────
    socket.on('join:leaderboard', () => {
      socket.join(WS_ROOMS.LEADERBOARD);
    });

    socket.on('join:activity', () => {
      socket.join(WS_ROOMS.ACTIVITY);
    });

    socket.on('join:stats', () => {
      socket.join(WS_ROOMS.STATS);
    });

    socket.on('join:country', (countryId: string) => {
      if (typeof countryId === 'string' && countryId.length > 0) {
        socket.join(WS_ROOMS.COUNTRY(countryId));
      }
    });

    socket.on('leave:country', (countryId: string) => {
      socket.leave(WS_ROOMS.COUNTRY(countryId));
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // ─── Subscribe to Redis pub/sub channels ────────────────────────────────
  redisSub.subscribe(
    WS_EVENTS.BID_NEW,
    WS_EVENTS.ACTIVITY_NEW,
    WS_EVENTS.STATS_UPDATE,
    WS_EVENTS.COUNTRY_RANK_CHANGE,
    (err?: Error | null) => {
      if (err) console.error('Redis subscribe error:', err);
      else console.log('✅ WebSocket subscribed to Redis channels');
    }
  );

  redisSub.on('message', async (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case WS_EVENTS.BID_NEW: {
          // Broadcast to leaderboard room
          io.to(WS_ROOMS.LEADERBOARD).emit(WS_EVENTS.BID_NEW, data);

          // Broadcast to country room
          if (data.country?.id) {
            io.to(WS_ROOMS.COUNTRY(data.country.id)).emit(WS_EVENTS.BID_NEW, data);
          }

          // If rank changed, broadcast full leaderboard update
          if (data.rankChange > 0) {
            const leaderboardData = await getLeaderboardSnapshot();
            io.to(WS_ROOMS.LEADERBOARD).emit(WS_EVENTS.LEADERBOARD_UPDATE, leaderboardData);
          }

          // Broadcast stats update
          const stats = await getStatsSnapshot();
          io.to(WS_ROOMS.STATS).emit(WS_EVENTS.STATS_UPDATE, { stats });

          break;
        }

        case WS_EVENTS.ACTIVITY_NEW: {
          io.to(WS_ROOMS.ACTIVITY).emit(WS_EVENTS.ACTIVITY_NEW, { activity: data });
          break;
        }

        case WS_EVENTS.COUNTRY_RANK_CHANGE: {
          if (data.countryId) {
            io.to(WS_ROOMS.COUNTRY(data.countryId)).emit(WS_EVENTS.COUNTRY_RANK_CHANGE, data);
          }
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLeaderboardSnapshot() {
  const entries = await prisma.country.findMany({
    where: { isActive: true, rank: { gt: 0 } },
    orderBy: { rank: 'asc' },
    take: 50,
    select: {
      id: true, name: true, isoCode: true, flag: true,
      totalSupport: true, currentBid: true, rank: true, previousRank: true, supporterCount: true,
    },
  });

  return {
    entries: entries.map((c) => ({
      rank: c.rank,
      previousRank: c.previousRank,
      rankChange: c.previousRank ? c.previousRank - c.rank : 0,
      country: c,
    })),
    updatedAt: new Date().toISOString(),
  };
}

async function getStatsSnapshot() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [totalCountries, totalSupportResult, totalSupporters, bidsToday, liveBids] = await Promise.all([
    prisma.country.count({ where: { isActive: true } }),
    prisma.bid.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
    prisma.user.count(),
    prisma.bid.count({ where: { status: 'CONFIRMED', createdAt: { gte: today } } }),
    prisma.bid.count({ where: { status: 'CONFIRMED', createdAt: { gte: fiveMinAgo } } }),
  ]);

  return {
    totalCountries,
    totalSupport: totalSupportResult._sum.amount ?? 0,
    totalSupporters,
    bidsToday,
    liveBids,
  };
}
