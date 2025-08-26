const DEFAULT_PORT = 8080;

const controller = new AbortController();
const timeoutMs = 3000;
const timeout = setTimeout(() => controller.abort(), timeoutMs);

async function main(): Promise<number> {
	try {
		const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
		const url = `http://127.0.0.1:${port}/api/healthz`;

		const res = await fetch(url, {
			method: 'GET',
			headers: {
				'accept': 'application/json',
				'user-agent': 'docker-healthcheck'
			},
			signal: controller.signal
		});

		if (!res.ok) {
			return 1;
		}

		const data = await res.json().catch(() => null) as any;
		if (!data || data.status !== 'ok') {
			return 1;
		}

		return 0;
	} catch (_err) {
		return 1;
	} finally {
		clearTimeout(timeout);
	}
}

main().then((code) => {
	process.exit(code);
});