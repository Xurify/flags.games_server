import { CustomWebSocket } from "../../../types/multiplayer";
import { InputSanitizer } from "./input-sanitizer";
import { SECURITY_CONFIG, isOriginAllowed, getClientIP } from "../../config/security";

export class WebSocketSecurity {
    private static suspiciousIPs = new Set<string>();
    private static connectionCounts = new Map<string, number>();

    static validateConnection(_ws: CustomWebSocket, request: Request): {
        allowed: boolean;
        reason?: string;
    } {
        const ip = getClientIP(request);

        if (this.suspiciousIPs.has(ip)) {
            return { allowed: false, reason: 'IP blocked' };
        }

        const currentConnections = this.connectionCounts.get(ip) || 0;
        if (currentConnections >= SECURITY_CONFIG.RATE_LIMITS.MAX_CONNECTIONS_PER_IP) {
            return { allowed: false, reason: 'Too many connections from IP' };
        }

        const origin = request.headers.get('origin');
        if (origin && !isOriginAllowed(origin)) {
            return { allowed: false, reason: 'Invalid origin' };
        }

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
            return { valid: false, reason: 'Message too large' };
        }

        if (!message.type || typeof message.type !== 'string') {
            return { valid: false, reason: 'Invalid message format' };
        }

        const stringifiedMessage = JSON.stringify(message);
        if (InputSanitizer.containsSQLInjection(stringifiedMessage) ||
            InputSanitizer.containsXSS(stringifiedMessage)) {
            return { valid: false, reason: 'Suspicious content detected' };
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