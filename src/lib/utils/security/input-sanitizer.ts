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
}