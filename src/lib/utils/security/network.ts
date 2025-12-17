import { SECURITY_CONFIG } from "./config";
import { isDevelopment } from "../env";

export const isOriginAllowed = (origin: string | null): boolean => {
    if (!origin) return isDevelopment ? true : false;
    return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin);
};

export const getClientIPAddress = (request: Request): string => {
    const headers = request.headers;

    let ip =
        headers.get("x-forwarded-for") ||
        headers.get("x-real-ip") ||
        headers.get("x-client-ip") ||
        "";

    if (ip) {
        // x-forwarded-for can be a list: client, proxy1, proxy2
        // forwarded can be: for=192.0.2.43, for="[2001:db8:cafe::17]";proto=https;by=203.0.113.43
        // Normalize by extracting the first IP
        if (ip.includes(",")) {
            ip = ip.split(",")[0].trim();
        }
        // Parse Forwarded header format
        if (ip.toLowerCase().includes("for=")) {
            const match = ip.match(/for=([^;,\s]+)/i);
            if (match && match[1]) {
                ip = match[1].replace(/^"|"$/g, "");
            }
        }
        // Strip IPv6 brackets if present
        ip = ip.replace(/^\[/, "").replace(/\]$/, "");
        return ip;
    }

    // Final fallback
    return isDevelopment ? "127.0.0.1" : "unknown";
};
