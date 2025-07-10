import { SECURITY_CONFIG, getClientIP } from '../../config/security';
import { logger } from '../logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export class RateLimiter {
  private static requests = new Map<string, RateLimitEntry>();
  private static blockedIPs = new Set<string>();

  private static readonly configs: Record<'default' | 'websocket' | 'api', RateLimitConfig> = {
    default: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      blockDurationMs: 5 * 60 * 1000, // 5 minutes
    },
    websocket: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // WebSocket connections per minute
      blockDurationMs: 10 * 60 * 1000, // 10 minutes
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
      blockDurationMs: 2 * 60 * 1000, // 2 minutes
    }
  };

  static checkRateLimit(
    request: Request,
    type: keyof typeof RateLimiter.configs = 'default'
  ): { allowed: boolean; reason?: string; retryAfter?: number } {
    const ip = getClientIP(request);
    const config = this.configs[type];
    const now = Date.now();

    if (this.blockedIPs.has(ip)) {
      return {
        allowed: false,
        reason: 'IP temporarily blocked',
        retryAfter: Math.ceil(config.blockDurationMs / 1000)
      };
    }

    let entry = this.requests.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        blocked: false
      };
      this.requests.set(ip, entry);
      return { allowed: true };
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
      if (!entry.blocked) {
        entry.blocked = true;
        this.blockedIPs.add(ip);

        setTimeout(() => {
          this.blockedIPs.delete(ip);
          logger.info(`IP ${ip} unblocked after rate limit timeout`);
        }, config.blockDurationMs);

        logger.warn(`IP ${ip} blocked for rate limiting. Requests: ${entry.count}/${config.maxRequests}`);
      }

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      };
    }

    return { allowed: true };
  }

  static createMiddleware(type: keyof typeof RateLimiter.configs = 'api') {
    return (request: Request): Response | null => {
      const result = this.checkRateLimit(request, type);
      
      if (!result.allowed) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter?.toString() || '60'
        };

        return new Response(
          JSON.stringify({
            error: result.reason || 'Rate limit exceeded',
            retryAfter: result.retryAfter
          }),
          {
            status: 429,
            headers
          }
        );
      }

      return null; // Allow request to continue
    };
  }

  static validateWebSocketConnection(request: Request): {
    allowed: boolean;
    reason?: string
  } {
    const ip = getClientIP(request);

    const rateCheck = this.checkRateLimit(request, 'websocket');
    if (!rateCheck.allowed) {
      return { allowed: false, reason: rateCheck.reason };
    }

    const connectionCount = this.getConnectionCount(ip);
    if (connectionCount >= SECURITY_CONFIG.RATE_LIMITS.MAX_CONNECTIONS_PER_IP) {
      logger.warn(`IP ${ip} rejected: too many concurrent connections (${connectionCount})`);
      return {
        allowed: false,
        reason: `Too many concurrent connections. Limit: ${SECURITY_CONFIG.RATE_LIMITS.MAX_CONNECTIONS_PER_IP}`
      };
    }

    return { allowed: true };
  }

  static trackWebSocketConnection(request: Request): void {
    const ip = getClientIP(request);
    const current = this.getConnectionCount(ip);
    this.setConnectionCount(ip, current + 1);
    
    logger.debug(`WebSocket connection tracked for IP ${ip}. Total: ${current + 1}`);
  }

  static untrackWebSocketConnection(request: Request): void {
    const ip = getClientIP(request);
    const current = this.getConnectionCount(ip);
    
    if (current <= 1) {
      this.connectionCounts.delete(ip);
    } else {
      this.setConnectionCount(ip, current - 1);
    }
    
    logger.debug(`WebSocket connection untracked for IP ${ip}. Remaining: ${Math.max(0, current - 1)}`);
  }

  private static connectionCounts = new Map<string, number>();

  private static getConnectionCount(ip: string): number {
    return this.connectionCounts.get(ip) || 0;
  }

  private static setConnectionCount(ip: string, count: number): void {
    this.connectionCounts.set(ip, count);
  }

  static getStats(): {
    totalTrackedIPs: number;
    blockedIPs: number;
    activeConnections: number;
  } {
    return {
      totalTrackedIPs: this.requests.size,
      blockedIPs: this.blockedIPs.size,
      activeConnections: Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0)
    };
  }

  static cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, entry] of this.requests.entries()) {
      if (now > entry.resetTime && !entry.blocked) {
        this.requests.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  static blockIP(ip: string, durationMs: number = 60 * 60 * 1000): void {
    this.blockedIPs.add(ip);
    
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info(`Manually blocked IP ${ip} has been unblocked`);
    }, durationMs);

    logger.warn(`IP ${ip} manually blocked for ${durationMs}ms`);
  }

  static unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.requests.delete(ip);
    logger.info(`IP ${ip} manually unblocked`);
  }
}

setInterval(() => {
  RateLimiter.cleanup();
}, 5 * 60 * 1000);
