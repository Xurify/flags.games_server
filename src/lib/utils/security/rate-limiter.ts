import { SECURITY_CONFIG } from "./config";

interface RateLimitRule {
  limit: number;
  resetIntervalMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  limit?: number;
  windowMs?: number;
}

interface RateLimiter {
  isAllowed(key: string, rule: RateLimitRule): boolean;
  consume(key: string, rule: RateLimitRule): RateLimitResult;
  getRemainingRequests(key: string, rule: RateLimitRule): number;
  getResetTime(key: string, rule: RateLimitRule): number;
}

interface WindowData {
  currentCount: number;
  previousCount: number;
  currentWindowStart: number;
  windowSizeMs: number;
  lastTouchedMs: number;
}

class SlidingWindowCounter implements RateLimiter {
  private windows = new Map<string, WindowData>();
  private operationCount = 0;

  isAllowed(key: string, rule: RateLimitRule): boolean {
    const now = Date.now();
    const window = this.getOrUpdateWindow(key, rule.resetIntervalMs, now);
    const weightedCount = this.calculateWeightedCount(window, now);
    
    return weightedCount < rule.limit;
  }

  getRemainingRequests(key: string, rule: RateLimitRule): number {
    const now = Date.now();
    const window = this.getOrUpdateWindow(key, rule.resetIntervalMs, now);
    const weightedCount = this.calculateWeightedCount(window, now);
    
    return Math.max(0, rule.limit - weightedCount);
  }

  getResetTime(key: string, rule: RateLimitRule): number {
    const now = Date.now();
    const window = this.getOrUpdateWindow(key, rule.resetIntervalMs, now);
    return window.currentWindowStart + window.windowSizeMs;
  }

  consume(key: string, rule: RateLimitRule): RateLimitResult {
    const now = Date.now();
    const window = this.getOrUpdateWindow(key, rule.resetIntervalMs, now);
    const weightedCount = this.calculateWeightedCount(window, now);
    const remaining = Math.max(0, rule.limit - weightedCount);

    if (weightedCount >= rule.limit) {
      const resetTime = window.currentWindowStart + window.windowSizeMs;
      const retryAfter = Math.max(0, resetTime - now);
      
      return {
        allowed: false,
        remaining,
        resetTime,
        retryAfter,
        limit: rule.limit,
        windowMs: rule.resetIntervalMs,
      };
    }

    window.currentCount += 1;
    window.lastTouchedMs = now;
    this.windows.set(key, window);
    
    this.cleanup();
    
    return {
      allowed: true,
      remaining: Math.max(0, remaining - 1),
      resetTime: window.currentWindowStart + window.windowSizeMs,
      limit: rule.limit,
      windowMs: rule.resetIntervalMs,
    };
  }

  private getOrUpdateWindow(key: string, windowSizeMs: number, now: number): WindowData {
    const currentWindowStart = Math.floor(now / windowSizeMs) * windowSizeMs;
    let window = this.windows.get(key);

    if (!window || window.windowSizeMs !== windowSizeMs) {
      window = {
        currentCount: 0,
        previousCount: 0,
        currentWindowStart,
        windowSizeMs,
        lastTouchedMs: now,
      };
      this.windows.set(key, window);
      return window;
    }

    if (now >= window.currentWindowStart + windowSizeMs) {
      const windowsElapsed = Math.floor((now - window.currentWindowStart) / windowSizeMs);
      window.previousCount = windowsElapsed === 1 ? window.currentCount : 0;
      window.currentCount = 0;
      window.currentWindowStart = currentWindowStart;
    }

    return window;
  }

  private calculateWeightedCount(window: WindowData, now: number): number {
    const elapsedInCurrentWindow = now - window.currentWindowStart;
    const previousWindowWeight = 1 - (elapsedInCurrentWindow / window.windowSizeMs);
    const weightedPreviousCount = Math.max(0, Math.min(1, previousWindowWeight)) * window.previousCount;
    
    return window.currentCount + weightedPreviousCount;
  }

  cleanup(): void {
    this.operationCount++;
    if (this.operationCount % 1000 !== 0) return;
    
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      if (now - window.lastTouchedMs > window.windowSizeMs * 3) {
        this.windows.delete(key);
      }
    }
  }
}

type ActionKey = keyof typeof SECURITY_CONFIG.RATE_LIMITS.ACTIONS;

interface RateLimitIdentifiers {
  userId?: string | null;
  ipAddress?: string | null;
  roomId?: string | null;
}

export class RateLimiterService {
  private limiter: RateLimiter;

  constructor(limiter: RateLimiter = new SlidingWindowCounter()) {
    this.limiter = limiter;
  }

  private buildKey(action: ActionKey, identifiers: RateLimitIdentifiers): string | null {
    const config = SECURITY_CONFIG.RATE_LIMITS.ACTIONS[action];
    if (!config) return null;

    if (config.perUser && identifiers.userId) {
      return `${action}:user:${identifiers.userId}`;
    }
    return null;
  }

  private getRule(action: ActionKey): RateLimitRule | null {
    const config = SECURITY_CONFIG.RATE_LIMITS.ACTIONS[action];
    if (!config?.perUser) return null;
    return config.perUser;
  }

  isAllowed(action: ActionKey, identifiers: RateLimitIdentifiers): boolean {
    const key = this.buildKey(action, identifiers);
    const rule = this.getRule(action);

    if (!key || !rule) return true;

    return this.limiter.isAllowed(key, rule);
  }

  getRemaining(action: ActionKey, identifiers: RateLimitIdentifiers): number {
    const key = this.buildKey(action, identifiers);
    const rule = this.getRule(action);

    if (!key || !rule) return Number.POSITIVE_INFINITY;

    return this.limiter.getRemainingRequests(key, rule);
  }

  getResetTime(action: ActionKey, identifiers: RateLimitIdentifiers): number {
    const key = this.buildKey(action, identifiers);
    const rule = this.getRule(action);

    if (!key || !rule) return Date.now();

    return this.limiter.getResetTime(key, rule);
  }

  consume(action: ActionKey, identifiers: RateLimitIdentifiers): RateLimitResult {
    const key = this.buildKey(action, identifiers);
    const rule = this.getRule(action);

    if (!key || !rule) {
      return {
        allowed: true,
        remaining: Number.POSITIVE_INFINITY,
        resetTime: Date.now(),
      };
    }

    return this.limiter.consume(key, rule);
  }

  cleanup(): void {
    if (this.limiter instanceof SlidingWindowCounter) {
      this.limiter.cleanup();
    }
  }
}

export const rateLimiter = new RateLimiterService();
