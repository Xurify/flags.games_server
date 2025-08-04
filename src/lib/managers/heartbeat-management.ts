import { CustomWebSocket } from "../../types/entities";
import { logger } from "../utils/logger";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";

interface HeartbeatConfig {
  interval: number;
  timeout: number;
  maxMissed: number;
  enableLogging: boolean;
}

interface HeartbeatState {
  interval: NodeJS.Timeout;
  timeout?: NodeJS.Timeout;
  missedCount: number;
  lastPing: number;
  lastPong: number;
}

export class HeartbeatManager {
  private heartbeats = new Map<string, HeartbeatState>();
  private config: HeartbeatConfig;
  private onConnectionDead: (userId: string) => void;
  private onUserActivity: (userId: string) => void;

  private readonly HEARTBEAT_MESSAGE_TEMPLATE = {
    type: WS_MESSAGE_TYPES.HEARTBEAT,
    timestamp: 0
  };

  constructor(
    config: Partial<HeartbeatConfig> = {},
    onConnectionDead: (userId: string) => void,
    onUserActivity: (userId: string) => void
  ) {
    this.config = {
      interval: 30000,
      timeout: 10000,
      maxMissed: 3,
      enableLogging: false,
      ...config
    };
    
    this.onConnectionDead = onConnectionDead;
    this.onUserActivity = onUserActivity;
  }

  startHeartbeat(userId: string, ws: CustomWebSocket): void {
    this.stopHeartbeat(userId);

    const state: HeartbeatState = {
      interval: setInterval(() => this.sendHeartbeat(userId, ws), this.config.interval),
      missedCount: 0,
      lastPing: Date.now(),
      lastPong: 0
    };

    this.heartbeats.set(userId, state);
    
    if (this.config.enableLogging) {
      logger.debug(`Started heartbeat for user ${userId}`);
    }
  }

  stopHeartbeat(userId: string): void {
    const state = this.heartbeats.get(userId);
    if (!state) return;

    clearInterval(state.interval);
    if (state.timeout) {
      clearTimeout(state.timeout);
    }

    this.heartbeats.delete(userId);
    
    if (this.config.enableLogging) {
      logger.debug(`Stopped heartbeat for user ${userId}`);
    }
  }

  handleHeartbeatResponse(userId: string): void {
    const state = this.heartbeats.get(userId);
    if (!state) return;

    if (state.timeout) {
      clearTimeout(state.timeout);
      state.timeout = undefined;
    }

    state.missedCount = 0;
    state.lastPong = Date.now();

    this.onUserActivity(userId);

    if (this.config.enableLogging) {
      logger.debug(`Received heartbeat response from user ${userId}`);
    }
  }

  private sendHeartbeat(userId: string, ws: CustomWebSocket): void {
    const state = this.heartbeats.get(userId);
    if (!state) return;

    if (ws.readyState !== WebSocket.OPEN) {
      this.handleDeadConnection(userId, 'Connection closed');
      return;
    }

    try {
      const message = {
        ...this.HEARTBEAT_MESSAGE_TEMPLATE,
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(message));
      state.lastPing = Date.now();

      state.timeout = setTimeout(() => {
        this.handleHeartbeatTimeout(userId);
      }, this.config.timeout);

    } catch (error) {
      this.handleDeadConnection(userId, `Send error: ${error}`);
    }
  }

  private handleHeartbeatTimeout(userId: string): void {
    const state = this.heartbeats.get(userId);
    if (!state) return;

    state.missedCount++;
    
    if (this.config.enableLogging) {
      logger.warn(`Heartbeat timeout for user ${userId} (missed: ${state.missedCount}/${this.config.maxMissed})`);
    }

    if (state.missedCount >= this.config.maxMissed) {
      this.handleDeadConnection(userId, 'Max missed heartbeats exceeded');
    }
  }

  private handleDeadConnection(userId: string, reason: string): void {
    if (this.config.enableLogging) {
      logger.warn(`Connection dead for user ${userId}: ${reason}`);
    }

    this.stopHeartbeat(userId);
    this.onConnectionDead(userId);
  }

  getStats(): {
    totalHeartbeats: number;
    activeHeartbeats: number;
    averageResponseTime: number;
    healthyConnections: number;
  } {
    let totalResponseTime = 0;
    let responseCount = 0;
    let healthyConnections = 0;

    this.heartbeats.forEach(state => {
      if (state.lastPong > 0) {
        const responseTime = state.lastPong - state.lastPing;
        if (responseTime > 0) {
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      if (state.missedCount === 0) {
        healthyConnections++;
      }
    });

    return {
      totalHeartbeats: this.heartbeats.size,
      activeHeartbeats: this.heartbeats.size,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      healthyConnections
    };
  }

  getHeartbeatStatus(userId: string): {
    isActive: boolean;
    missedCount: number;
    lastPing: number;
    lastPong: number;
    responseTime: number;
  } | null {
    const state = this.heartbeats.get(userId);
    if (!state) return null;

    return {
      isActive: true,
      missedCount: state.missedCount,
      lastPing: state.lastPing,
      lastPong: state.lastPong,
      responseTime: state.lastPong > 0 ? state.lastPong - state.lastPing : 0
    };
  }

  cleanup(): void {
    this.heartbeats.forEach((_, userId) => {
      this.stopHeartbeat(userId);
    });
  }

  getActiveHeartbeats(): string[] {
    return Array.from(this.heartbeats.keys());
  }
}