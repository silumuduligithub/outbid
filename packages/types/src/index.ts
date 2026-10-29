// ─────────────────────────────────────────────────────────────────────────────
// WorldBid Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type BidStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ActivityType =
  | 'BID_PLACED'
  | 'RANK_CHANGED'
  | 'COUNTRY_OVERTAKEN'
  | 'TOP_TEN_ENTRY'
  | 'TOP_THREE_ENTRY'
  | 'RANK_ONE_ACHIEVED';

export type Continent =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Antarctica';

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string | null;
  countryCode?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar?: string | null;
  countryCode?: string | null;
}

// ─── Country ─────────────────────────────────────────────────────────────────

export interface Country {
  id: string;
  name: string;
  officialName: string;
  isoCode: string;  // ISO 3166-1 alpha-2 (2-letter)
  iso3Code: string; // ISO 3166-1 alpha-3 (3-letter)
  flag: string;     // Unicode emoji flag
  continent: Continent;
  currency: string;
  description?: string | null;
  totalSupport: number;
  currentBid: number;
  rank: number;
  previousRank?: number | null;
  supporterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountryWithChange extends Country {
  rankChange: number; // positive = moved up, negative = moved down
  bidChangeToday: number;
  isNew?: boolean; // new to top 10, etc.
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  previousRank?: number | null;
  rankChange: number;
  country: Country;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  updatedAt: string;
  totalCountries: number;
}

export interface LeaderboardHistoryPoint {
  timestamp: string;
  rank: number;
  totalSupport: number;
}

// ─── Bid ─────────────────────────────────────────────────────────────────────

export interface Bid {
  id: string;
  userId: string;
  countryId: string;
  amount: number;
  currency: string;
  status: BidStatus;
  transactionId?: string | null;
  createdAt: string;
}

export interface BidResult {
  bid: Bid;
  country: Country;
  previousRank: number;
  newRank: number;
  rankChange: number;
  overtookCountry?: { id: string; name: string; flag: string; isoCode: string } | null;
  message: string;
}

export interface CreateBidRequest {
  countryId: string;
  amount: number;
  currency?: string;
  idempotencyKey: string;
}

export interface MinimumBidInfo {
  countryId: string;
  countryName: string;
  currentBid: number;
  currentRank: number;
  minimumNextBid: number; // to move up 1 position
  targetCountry?: {
    id: string;
    name: string;
    currentBid: number;
    rank: number;
  } | null;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  userId: string;
  bidId: string;
  provider: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface CreatePaymentRequest {
  bidId: string;
  amount: number;
  currency: string;
  provider?: string;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  countryId: string;
  country: {
    name: string;
    flag: string;
    isoCode: string;
  };
  userId?: string | null;
  user?: {
    username: string;
    avatar?: string | null;
  } | null;
  amount?: number | null;
  previousRank?: number | null;
  newRank?: number | null;
  relatedCountry?: {
    id: string;
    name: string;
    flag: string;
  } | null;
  createdAt: string;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface GlobalStats {
  totalCountries: number;
  totalSupport: number;
  totalSupporters: number;
  bidsToday: number;
  liveBids: number;
  topCountry: {
    name: string;
    flag: string;
    isoCode: string;
    totalSupport: number;
  } | null;
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export interface WsLeaderboardUpdate {
  entries: LeaderboardEntry[];
  updatedAt: string;
}

export interface WsBidEvent {
  bid: Bid;
  country: Country;
  previousRank: number;
  newRank: number;
}

export interface WsActivityEvent {
  activity: ActivityEvent;
}

export interface WsStatsUpdate {
  stats: GlobalStats;
}

export type WsEvent =
  | { type: 'leaderboard:update'; data: WsLeaderboardUpdate }
  | { type: 'bid:new'; data: WsBidEvent }
  | { type: 'activity:new'; data: WsActivityEvent }
  | { type: 'stats:update'; data: WsStatsUpdate }
  | { type: 'country:rankChange'; data: { countryId: string; previousRank: number; newRank: number } };

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile extends User {
  totalSupport: number;
  countriesSupported: number;
  bidsCount: number;
  topCountry?: {
    name: string;
    flag: string;
    isoCode: string;
    totalAmount: number;
  } | null;
  recentBids: Array<{
    id: string;
    country: { name: string; flag: string; isoCode: string };
    amount: number;
    createdAt: string;
  }>;
  supportedCountries: Array<{
    country: Country;
    totalAmount: number;
    bidsCount: number;
  }>;
}
