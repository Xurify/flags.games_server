import { CustomWebSocket } from "../../../types/entities";
import { InputSanitizer } from "./input-sanitizer";
import { SECURITY_CONFIG, isOriginAllowed, getClientIP } from "../../config/security";

export class WebSocketSecurity {
    private static suspiciousIPs = new Set<string>();
    private static connectionCounts = new Map<string, number>();
    private static connectionTimestamps = new Map<string, number[]>();

    static validateConnection(_ws: CustomWebSocket, request: Request): {
        allowed: boolean;
        reason?: string;
    } {
        const ip = getClientIP(request);

        if (this.suspiciousIPs.has(ip)) {
            return { allowed: false, reason: 'IP blocked' };
        }

        // Clean old connection timestamps (older than 5 minutes)
        const now = Date.now();
        const timestamps = this.connectionTimestamps.get(ip) || [];
        const recentTimestamps = timestamps.filter(ts => now - ts < 5 * 60 * 1000);
        this.connectionTimestamps.set(ip, recentTimestamps);

        // Check for rapid connection attempts (more than 3 in 1 minute = suspicious)
        const recentConnections = recentTimestamps.filter(ts => now - ts < 60 * 1000);
        if (recentConnections.length > 3) {
            this.suspiciousIPs.add(ip);
            return { allowed: false, reason: 'Too many rapid connection attempts' };
        }

        const currentConnections = this.connectionCounts.get(ip) || 0;
        if (currentConnections >= SECURITY_CONFIG.RATE_LIMITS.MAX_CONNECTIONS_PER_IP) {
            return { allowed: false, reason: 'Too many connections from IP' };
        }

        const origin = request.headers.get('origin');
        if (origin && !isOriginAllowed(origin)) {
            return { allowed: false, reason: 'Invalid origin' };
        }

        // Track this connection attempt
        recentTimestamps.push(now);
        this.connectionTimestamps.set(ip, recentTimestamps);

        return { allowed: true };
    }

    static trackConnection(_ws: CustomWebSocket, request: Request): void {
        const ip = getClientIP(request);
        const current = this.connectionCounts.get(ip) || 0;
        this.connectionCounts.set(ip, current + 1);
    }

    static untrackConnection(request: Request): void {
        const ip = getClientIP(request);
        const current = this.connectionCounts.get(ip) || 0;
        if (current <= 1) {
            this.connectionCounts.delete(ip);
        } else {
            this.connectionCounts.set(ip, current - 1);
        }
    }

    static validateMessage(message: any): { valid: boolean; reason?: string } {
        if (JSON.stringify(message).length > SECURITY_CONFIG.RATE_LIMITS.MESSAGE_SIZE_LIMIT) {
            return { valid: false, reason: 'Message too large: exceeds allowed size limit' };
        }

        if (!message.type || typeof message.type !== 'string') {
            return { valid: false, reason: "Missing or invalid 'type' field in message" };
        }
        
        return { valid: true };
    }

    static blockIP(ip: string): void {
        this.suspiciousIPs.add(ip);
    }

    static unblockIP(ip: string): void {
        this.suspiciousIPs.delete(ip);
    }
}