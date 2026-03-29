/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Event bus for SSE broadcasting in web-server
 * Simplified version of OpenCode's Effect PubSub pattern for Express
 */

export interface SessionEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

class EventBus {
  private subscribers: Set<(event: SessionEvent) => void> = new Set();

  publish(event: SessionEvent): void {
    for (const callback of this.subscribers) {
      callback(event);
    }
  }

  subscribe(callback: (event: SessionEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  unsubscribe(callback: (event: SessionEvent) => void): void {
    this.subscribers.delete(callback);
  }
}

export const eventBus = new EventBus();
