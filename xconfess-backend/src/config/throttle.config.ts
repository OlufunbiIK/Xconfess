import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  // Default/global profile — applies to all routes via APP_GUARD.
  //
  // NOTE: kept as raw seconds here for backwards compatibility with the
  // existing env var (THROTTLE_TTL), since this value is consumed
  // directly in app.module.ts. @nestjs/throttler v6 expects ttl in
  // MILLISECONDS — see https://github.com/nestjs/throttler (v5 migration
  // notes). This config value does not appear to be converted at the
  // call site today, which likely makes the existing global throttle
  // window ~900ms instead of the intended 900s. Flagged separately;
  // fixing it is out of scope for this PR (anchor/verify throttling),
  // so the value/semantics here are left untouched.
  ttl: parseInt(process.env.THROTTLE_TTL ?? '900', 10), // intended: 15 min (seconds)
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10), // requests per TTL

  /**
   * Strict profile for endpoints that trigger expensive Stellar
   * Horizon/RPC calls (confession anchoring, tip verification).
   *
   * Tighter window + lower ceiling than the global default, since each
   * request here can cost real RPC quota/latency rather than just a DB hit.
   * Keyed per (IP + confession id) — see StrictThrottlerGuard.
   *
   * Expressed in seconds here for readability; converted to ms with the
   * `seconds()` helper at the ThrottlerModule registration site.
   */
  strictTtlSeconds: parseInt(process.env.THROTTLE_STRICT_TTL ?? '60', 10), // 1 minute window
  strictLimit: parseInt(process.env.THROTTLE_STRICT_LIMIT ?? '5', 10), // 5 requests per window
}));