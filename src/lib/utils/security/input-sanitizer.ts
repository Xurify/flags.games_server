import DOMPurify from 'isomorphic-dompurify';

export class InputSanitizer {
    private static readonly PURIFY_CONFIG = {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
    };

    static sanitizeForDisplay(input: string): string {
        return DOMPurify.sanitize(input, this.PURIFY_CONFIG).trim();
    }

    static sanitizeUsername(username: string): string {
        const cleaned = username
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 20);

        return DOMPurify.sanitize(cleaned, this.PURIFY_CONFIG);
    }

    static sanitizeRoomName(roomName: string): string {
        const cleaned = roomName
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 50);

        return DOMPurify.sanitize(cleaned, this.PURIFY_CONFIG);
    }

    static sanitizeString(input: string): string {
        return input
            .trim()
            .replace(/[<>'"&]/g, '') // Remove HTML/script characters
            .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .substring(0, 1000); // Limit length
    }

    static containsSQLInjection(input: string): boolean {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /(--|\/\*|\*\/|;|'|"|`)/,
            /(\bOR\b|\bAND\b).*(=|<|>)/i
        ];

        return sqlPatterns.some(pattern => pattern.test(input));
    }

    static containsXSS(input: string): boolean {
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<[^>]*>/g
        ];

        return xssPatterns.some(pattern => pattern.test(input));
    }

    static isInputSafe(input: string): { safe: boolean; reason?: string } {
        if (this.containsSQLInjection(input)) {
            return { safe: false, reason: 'Potential SQL injection detected' };
        }

        if (this.containsXSS(input)) {
            return { safe: false, reason: 'Potential XSS detected' };
        }

        return { safe: true };
    }
}