class MetricsCollector {
  private metrics = {
    activeConnections: 0,
    activeRooms: 0,
    activeUsers: 0,
    activeGames: 0,
    totalMessages: 0,
    clientErrors: 0,
    serverErrors: 0,
    lastErrorTime: null as null | number,
    errorRate: 0,
    lastError: null as null | string,
    lastUpdated: Date.now(),
  };

  increment(key: keyof typeof this.metrics, value = 1) {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number) += value;
      this.metrics.lastUpdated = Date.now();
    }
  }

  set(key: keyof typeof this.metrics, value: number | string | null) {
    this.metrics[key] = value as never;
    this.metrics.lastUpdated = Date.now();
  }

  getMetrics() {
    return { ...this.metrics, uptime: process.uptime ? process.uptime() : undefined };
  }
}

export const metricsCollector = new MetricsCollector();