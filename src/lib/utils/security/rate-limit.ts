export class FixedWindowRateLimiter {
	private readonly windowMs: number;
	private readonly limit: number;
	private windowStartMs: number;
	private counts: Map<string, number>;

	constructor(limit: number, windowMs: number) {
		this.limit = limit;
		this.windowMs = windowMs;
		this.windowStartMs = Date.now();
		this.counts = new Map();
	}

	allow(key: string): boolean {
		const now = Date.now();
		if (now - this.windowStartMs >= this.windowMs) {
			// start a new window and clear old counters
			this.windowStartMs = now;
			this.counts.clear();
		}

		const current = this.counts.get(key) || 0;
		if (current >= this.limit) {
			return false;
		}
		this.counts.set(key, current + 1);
		return true;
	}
}