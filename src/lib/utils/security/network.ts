import { SECURITY_CONFIG } from "./config";
import { isDevelopment } from "../env";

export const isOriginAllowed = (origin: string | null): boolean => {
    if (!origin) return isDevelopment;
    return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin);
};

export const getClientIPAddress = (request: Request): string => {
    return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
};
