// ─── Shared Constants ─────────────────────────────────────────────────────────

export const APP_NAME = 'WorldBid';
export const APP_TAGLINE = 'The World Is Up For Grabs';

export const CURRENCIES = ['USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'USD';

export const MIN_BID_AMOUNT = 1; // $1 minimum
export const MAX_BID_AMOUNT = 1_000_000; // $1M maximum

export const DEV_BID_AMOUNTS = [10, 50, 100, 500, 1000, 5000] as const;

export const LEADERBOARD_PAGE_SIZE = 50;
export const ACTIVITY_FEED_SIZE = 50;
export const SEARCH_RESULTS_LIMIT = 20;

export const LEADERBOARD_CACHE_TTL = 5; // seconds
export const COUNTRY_CACHE_TTL = 30; // seconds

export const WS_ROOMS = {
  LEADERBOARD: 'leaderboard',
  ACTIVITY: 'activity',
  STATS: 'stats',
  COUNTRY: (id: string) => `country:${id}`,
} as const;

export const WS_EVENTS = {
  LEADERBOARD_UPDATE: 'leaderboard:update',
  BID_NEW: 'bid:new',
  ACTIVITY_NEW: 'activity:new',
  STATS_UPDATE: 'stats:update',
  COUNTRY_RANK_CHANGE: 'country:rankChange',
} as const;

export const BID_MINIMUM_MARGIN = 1; // $1 above current bid to move up

export const RATE_LIMITS = {
  API: { max: 100, windowMs: 60_000 },
  BID: { max: 10, windowMs: 60_000 },
  AUTH: { max: 10, windowMs: 60_000 },
} as const;

export const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
] as const;
