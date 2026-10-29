import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  countryCode: z.string().length(2).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Bid ─────────────────────────────────────────────────────────────────────

export const CreateBidSchema = z.object({
  countryId: z.string().uuid('Invalid country ID'),
  amount: z
    .number()
    .min(1, 'Minimum bid is $1')
    .max(1_000_000, 'Maximum bid is $1,000,000'),
  currency: z.string().default('USD'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

// ─── Payment ─────────────────────────────────────────────────────────────────

export const CreatePaymentSchema = z.object({
  bidId: z.string().uuid(),
  amount: z.number().min(1),
  currency: z.string().default('USD'),
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export const LeaderboardQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(50),
  continent: z.string().optional(),
});

export const HistoryQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
});

// ─── Country ─────────────────────────────────────────────────────────────────

export const CountrySearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// ─── User ─────────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatar: z.string().url().optional(),
  countryCode: z.string().length(2).optional(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

// ─── Admin ────────────────────────────────────────────────────────────────────

export const AdminFreezeUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const AdminRefundBidSchema = z.object({
  bidId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateBidInput = z.infer<typeof CreateBidSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
export type CountrySearchQuery = z.infer<typeof CountrySearchSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type PaginationQuery = z.infer<typeof PaginationSchema>;
