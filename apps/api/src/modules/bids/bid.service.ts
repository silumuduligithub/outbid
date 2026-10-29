import { prisma } from '../../lib/prisma.js';
import { redis, redisPub } from '../../lib/redis.js';
import { WS_EVENTS, WS_ROOMS } from '@worldbid/config';
import type { CreateBidInput } from '@worldbid/validation';
import type { BidResult } from '@worldbid/types';
import type { Prisma } from '@prisma/client';

// ─── Bid Service ─────────────────────────────────────────────────────────────
// Uses PostgreSQL SELECT FOR UPDATE for row-level locking.
// This ensures atomic bid processing even under heavy concurrent load.

export async function processBid(
  userId: string,
  input: CreateBidInput
): Promise<BidResult> {
  // 1. Idempotency check (outside transaction)
  const existingBid = await prisma.bid.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { country: true },
  });

  if (existingBid) {
    // Return existing result rather than processing twice
    const previousRank = existingBid.country.previousRank ?? existingBid.country.rank;
    return {
      bid: {
        id: existingBid.id,
        userId: existingBid.userId,
        countryId: existingBid.countryId,
        amount: existingBid.amount,
        currency: existingBid.currency,
        status: existingBid.status,
        transactionId: existingBid.transactionId,
        createdAt: existingBid.createdAt.toISOString(),
      },
      country: mapCountry(existingBid.country),
      previousRank,
      newRank: existingBid.country.rank,
      rankChange: previousRank - existingBid.country.rank,
      overtookCountry: null,
      message: 'Bid already processed (idempotent)',
    };
  }

  // 2. Rate limiting
  const rateLimitKey = `bid_rate:${userId}`;
  const bidCount = await redis.incr(rateLimitKey);
  if (bidCount === 1) {
    await redis.expire(rateLimitKey, 60);
  }
  if (bidCount > 10) {
    throw new BidError('Too many bids. Please wait before bidding again.', 'RATE_LIMITED', 429);
  }

  // 3. Execute atomic transaction with row-level locking
  return await prisma.$transaction(
    async (tx) => {
      // Lock the target country row
      const country = await tx.$queryRaw<Array<{
        id: string; name: string; officialName: string; isoCode: string;
        iso3Code: string; flag: string; continent: string; currency: string;
        description: string | null; totalSupport: number; currentBid: number;
        rank: number; previousRank: number | null; supporterCount: number;
        isActive: boolean; createdAt: Date; updatedAt: Date;
      }>>`
        SELECT * FROM countries WHERE id = ${input.countryId} AND "isActive" = true FOR UPDATE
      `;

      if (!country[0]) {
        throw new BidError('Country not found or inactive', 'COUNTRY_NOT_FOUND', 404);
      }

      const targetCountry = country[0];

      // 4. Validate bid amount server-side
      // Find the country 1 rank above
      let countryAbove = null;
      if (targetCountry.rank > 1) {
        const above = await tx.$queryRaw<Array<{
          id: string; name: string; flag: string; isoCode: string;
          currentBid: number; rank: number;
        }>>`
          SELECT id, name, flag, "isoCode", "currentBid", rank FROM countries 
          WHERE rank = ${targetCountry.rank - 1} AND "isActive" = true FOR UPDATE
        `;
        countryAbove = above[0] ?? null;
      }

      // Validate: amount must beat current country bid AND beat above country
      if (input.amount <= targetCountry.currentBid) {
        throw new BidError(
          `Bid must be greater than current bid of $${targetCountry.currentBid.toFixed(2)}`,
          'BID_TOO_LOW',
          400
        );
      }

      // 5. Snapshot previous rank
      const previousRank = targetCountry.rank;
      let newRank = targetCountry.rank;

      // 6. Calculate new rank
      if (countryAbove && input.amount > countryAbove.currentBid) {
        newRank = targetCountry.rank - 1;
      }

      // 7. Update target country
      await tx.$executeRaw`
        UPDATE countries SET
          "totalSupport" = "totalSupport" + ${input.amount},
          "currentBid" = ${input.amount},
          "previousRank" = rank,
          rank = ${newRank},
          "supporterCount" = "supporterCount" + 1,
          "updatedAt" = NOW()
        WHERE id = ${input.countryId}
      `;

      // 8. If rank changed, update the displaced country
      let overtookCountryData = null;
      if (newRank < previousRank && countryAbove) {
        const displacedNewRank = countryAbove.rank + 1;
        await tx.$executeRaw`
          UPDATE countries SET
            "previousRank" = rank,
            rank = ${displacedNewRank},
            "updatedAt" = NOW()
          WHERE id = ${countryAbove.id}
        `;

        overtookCountryData = {
          id: countryAbove.id,
          name: countryAbove.name,
          flag: countryAbove.flag,
          isoCode: countryAbove.isoCode,
        };
      }

      // 9. Create bid record
      const bid = await tx.bid.create({
        data: {
          userId,
          countryId: input.countryId,
          amount: input.amount,
          currency: input.currency,
          status: 'CONFIRMED',
          idempotencyKey: input.idempotencyKey,
        },
      });

      // 10. Update country support tracking
      await tx.countrySupport.upsert({
        where: { userId_countryId: { userId, countryId: input.countryId } },
        update: {
          totalAmount: { increment: input.amount },
          bidsCount: { increment: 1 },
          lastBidAt: new Date(),
        },
        create: {
          userId,
          countryId: input.countryId,
          totalAmount: input.amount,
          bidsCount: 1,
        },
      });

      // 11. Create activity events
      const activityEvents: Prisma.ActivityCreateManyInput[] = [
        {
          type: 'BID_PLACED',
          countryId: input.countryId,
          userId,
          amount: input.amount,
          previousRank,
          newRank,
        },
      ];

      if (newRank < previousRank) {
        activityEvents.push({
          type: 'RANK_CHANGED',
          countryId: input.countryId,
          userId,
          previousRank,
          newRank,
        });

        if (countryAbove) {
          activityEvents.push({
            type: 'COUNTRY_OVERTAKEN',
            countryId: input.countryId,
            userId,
            previousRank,
            newRank,
            relatedCountryId: countryAbove.id,
          });
        }

        if (newRank <= 1) {
          activityEvents.push({ type: 'RANK_ONE_ACHIEVED', countryId: input.countryId, userId, newRank, previousRank });
        } else if (newRank <= 3) {
          activityEvents.push({ type: 'TOP_THREE_ENTRY', countryId: input.countryId, userId, newRank, previousRank });
        } else if (newRank <= 10 && previousRank > 10) {
          activityEvents.push({ type: 'TOP_TEN_ENTRY', countryId: input.countryId, userId, newRank, previousRank });
        }
      }

      await tx.activity.createMany({ data: activityEvents });

      // 12. Snapshot leaderboard
      const updatedCountry = await tx.country.findUnique({ where: { id: input.countryId } });

      if (updatedCountry) {
        await tx.leaderboardSnapshot.create({
          data: {
            countryId: input.countryId,
            rank: newRank,
            totalSupport: updatedCountry.totalSupport,
            currentBid: updatedCountry.currentBid,
          },
        });
      }

      const countryResult = await tx.country.findUnique({ where: { id: input.countryId } });

      if (!countryResult) throw new Error('Failed to fetch updated country');

      const rankChange = previousRank - newRank;
      const message = newRank < previousRank
        ? `🔥 ${countryResult.name} moved from #${previousRank} to #${newRank}! (+${rankChange} ${rankChange === 1 ? 'position' : 'positions'})`
        : `✨ ${countryResult.name} received $${input.amount.toLocaleString()} support!`;

      return {
        bid: {
          id: bid.id,
          userId: bid.userId,
          countryId: bid.countryId,
          amount: bid.amount,
          currency: bid.currency,
          status: bid.status,
          transactionId: bid.transactionId,
          createdAt: bid.createdAt.toISOString(),
        },
        country: mapCountry(countryResult),
        previousRank,
        newRank,
        rankChange,
        overtookCountry: overtookCountryData,
        message,
      };
    },
    { timeout: 10_000 } // 10s timeout
  );
}

// ─── Invalidate caches and publish WebSocket events ───────────────────────────

export async function publishBidResult(result: BidResult): Promise<void> {
  // Invalidate leaderboard cache
  const keys = await redis.keys('leaderboard:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Invalidate country caches
  await redis.del(`country:${result.country.id}`);
  await redis.del(`country:${result.country.isoCode}`);

  // Publish WebSocket events via Redis pub/sub
  await Promise.all([
    redisPub.publish(WS_EVENTS.BID_NEW, JSON.stringify(result)),
    redisPub.publish(WS_EVENTS.ACTIVITY_NEW, JSON.stringify({
      type: result.rankChange > 0 ? 'RANK_CHANGED' : 'BID_PLACED',
      country: result.country,
      amount: result.bid.amount,
      previousRank: result.previousRank,
      newRank: result.newRank,
    })),
    redisPub.publish(WS_EVENTS.COUNTRY_RANK_CHANGE, JSON.stringify({
      countryId: result.country.id,
      previousRank: result.previousRank,
      newRank: result.newRank,
    })),
  ]);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function mapCountry(c: any) {
  return {
    id: c.id,
    name: c.name,
    officialName: c.officialName ?? c.official_name,
    isoCode: c.isoCode ?? c.iso_code,
    iso3Code: c.iso3Code ?? c.iso3_code,
    flag: c.flag,
    continent: c.continent,
    currency: c.currency,
    description: c.description,
    totalSupport: c.totalSupport ?? c.total_support,
    currentBid: c.currentBid ?? c.current_bid,
    rank: c.rank,
    previousRank: c.previousRank ?? c.previous_rank,
    supporterCount: c.supporterCount ?? c.supporter_count,
    createdAt: (c.createdAt ?? c.created_at)?.toISOString?.() ?? c.createdAt,
    updatedAt: (c.updatedAt ?? c.updated_at)?.toISOString?.() ?? c.updatedAt,
  };
}

export class BidError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'BidError';
  }
}
