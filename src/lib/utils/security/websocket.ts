import { CustomWebSocket } from "../../../types/entities";
import { SECURITY_CONFIG } from "./config";
import { isOriginAllowed, getClientIPAddress } from "./network";
import { parseCookies } from "./cookies";

export class WebSocketSecurity {
    private static suspiciousIPs = new Set<string>();
    private static connectionCounts = new Map<string, number>();

    static validateConnection(_ws: CustomWebSocket, request: Request): {
        allowed: boolean;
        reason?: string;
    } {
        const ipAddress = getClientIPAddress(request);

        if (this.suspiciousIPs.has(ipAddress)) {
            return { allowed: false, reason: 'This IP has been blocked' };
        }

        const currentConnections = this.connectionCounts.get(ipAddress) || 0;
        if (currentConnections >= SECURITY_CONFIG.RATE_LIMITS.MAX_CONNECTIONS_PER_IP) {
            return { allowed: false, reason: 'Too many connections from IP' };
        }

        const origin = request.headers.get('origin');
        if (origin && !isOriginAllowed(origin)) {
            return { allowed: false, reason: 'Invalid origin' };
        }

        const cookieHeader = request.headers.get('cookie');
        const cookies = parseCookies(cookieHeader);
        const sessionToken = cookies['session_token'];
        if (!sessionToken) {
            return { allowed: false, reason: 'Missing session token' };
        }

        return { allowed: true };
    }

    static trackConnection(_ws: CustomWebSocket, request: Request): void {
        const ipAddress = getClientIPAddress(request);
        const current = this.connectionCounts.get(ipAddress) || 0;
        this.connectionCounts.set(ipAddress, current + 1);
    }

    static untrackConnection(request: Request): void {
        const ipAddress = getClientIPAddress(request);
        const current = this.connectionCounts.get(ipAddress) || 0;
        if (current <= 1) {
            this.connectionCounts.delete(ipAddress);
        } else {
            this.connectionCounts.set(ipAddress, current - 1);
        }
    }

    static untrackByIp(ip: string): void {
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