import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { processBid } from '../src/modules/bids/bid.service.js';

const prisma = new PrismaClient();

describe('Bid Concurrency Tests', () => {
  let testCountryId: string;
  let aboveCountryId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test countries
    const aboveCountry = await prisma.country.create({
      data: {
        name: 'Test Country Above',
        officialName: 'Test Country Above',
        isoCode: 'TA',
        iso3Code: 'TAB',
        flag: '🏳️',
        continent: 'Asia',
        currency: 'USD',
        totalSupport: 1000,
        currentBid: 1000,
        rank: 1,
        supporterCount: 0,
      },
    });

    const testCountry = await prisma.country.create({
      data: {
        name: 'Test Country',
        officialName: 'Test Country',
        isoCode: 'TC',
        iso3Code: 'TCO',
        flag: '🏳️',
        continent: 'Asia',
        currency: 'USD',
        totalSupport: 500,
        currentBid: 500,
        rank: 2,
        supporterCount: 0,
      },
    });

    const testUser = await prisma.user.create({
      data: {
        email: 'test-concurrency@worldbid.app',
        username: 'test_concurrency_user',
        passwordHash: 'test',
        role: 'USER',
      },
    });

    testCountryId = testCountry.id;
    aboveCountryId = aboveCountry.id;
    testUserId = testUser.id;
  });

  beforeEach(async () => {
    const { redis } = await import('../src/lib/redis.js');
    await redis.del(`bid_rate:${testUserId}`);
  });

  afterAll(async () => {
    // Clean up
    await prisma.activity.deleteMany({ where: { countryId: { in: [testCountryId, aboveCountryId] } } });
    await prisma.countrySupport.deleteMany({ where: { userId: testUserId } });
    await prisma.leaderboardSnapshot.deleteMany({ where: { countryId: { in: [testCountryId, aboveCountryId] } } });
    await prisma.bid.deleteMany({ where: { userId: testUserId } });
    await prisma.country.deleteMany({ where: { id: { in: [testCountryId, aboveCountryId] } } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('should handle concurrent bids on the same country correctly', async () => {
    const CONCURRENT_BIDS = 10;
    const baseAmount = 600;

    // Create 10 concurrent bids with different amounts
    const bidPromises = Array.from({ length: CONCURRENT_BIDS }, (_, i) =>
      processBid(testUserId, {
        countryId: testCountryId,
        amount: baseAmount + i * 10,
        currency: 'USD',
        idempotencyKey: `concurrency-test-${Date.now()}-${i}`,
      }).catch((err) => ({ error: err.message, code: err.code ?? 'UNKNOWN' }))
    );

    const results = await Promise.all(bidPromises);

    // Count successes and errors
    const successes = results.filter((r) => !('error' in r));
    const errors = results.filter((r) => 'error' in r);

    console.log(`Successes: ${successes.length}, Errors: ${errors.length}`);

    // At least one bid should succeed
    expect(successes.length).toBeGreaterThan(0);

    // Verify country state is consistent
    const finalCountry = await prisma.country.findUnique({ where: { id: testCountryId } });
    expect(finalCountry).not.toBeNull();

    // The final bid amount should be the highest winning bid
    if (successes.length > 0) {
      const highestWin = successes
        .filter((r): r is Awaited<ReturnType<typeof processBid>> => !('error' in r))
        .reduce((max, r) => (r.bid.amount > max ? r.bid.amount : max), 0);

      expect(finalCountry!.currentBid).toBeGreaterThanOrEqual(highestWin);
    }
  });

  it('should prevent duplicate bids with same idempotency key', async () => {
    const idempotencyKey = `idempotency-test-${Date.now()}`;
    const amount = 750;

    const result1 = await processBid(testUserId, {
      countryId: testCountryId,
      amount,
      currency: 'USD',
      idempotencyKey,
    });

    const result2 = await processBid(testUserId, {
      countryId: testCountryId,
      amount,
      currency: 'USD',
      idempotencyKey,
    });

    // Both should succeed (idempotent)
    expect(result1.bid.id).toBe(result2.bid.id);
    expect(result2.message).toContain('idempotent');
  });

  it('should reject bid below current amount', async () => {
    const currentCountry = await prisma.country.findUnique({ where: { id: testCountryId } });
    const currentBid = currentCountry?.currentBid ?? 500;

    await expect(
      processBid(testUserId, {
        countryId: testCountryId,
        amount: currentBid - 10, // Lower than current
        currency: 'USD',
        idempotencyKey: `below-test-${Date.now()}`,
      })
    ).rejects.toMatchObject({
      code: 'BID_TOO_LOW',
    });
  });

  it('should correctly update rank when bid beats country above', async () => {
    // Reset the test countries to known state
    await prisma.country.update({ where: { id: testCountryId }, data: { rank: 2, currentBid: 500, totalSupport: 500 } });
    await prisma.country.update({ where: { id: aboveCountryId }, data: { rank: 1, currentBid: 1000, totalSupport: 1000 } });

    // Place a bid higher than the country above
    const result = await processBid(testUserId, {
      countryId: testCountryId,
      amount: 1500, // Higher than 1000
      currency: 'USD',
      idempotencyKey: `rank-up-test-${Date.now()}`,
    });

    expect(result.newRank).toBeLessThan(result.previousRank);
    expect(result.rankChange).toBeGreaterThan(0);
    expect(result.country.rank).toBe(result.newRank);

    // Verify the displaced country moved down
    const displaced = await prisma.country.findUnique({ where: { id: aboveCountryId } });
    expect(displaced?.rank).toBeGreaterThan(1);
  });
});
