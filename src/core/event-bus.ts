import EventEmitter from "eventemitter3";
import type { OrchestratorEvent } from "./types.js";
import { logger } from "./logger.js";

type EventMap = {
  [K in OrchestratorEvent["type"]]: Extract<OrchestratorEvent, { type: K }>;
};

class OrchestratorEventBus extends EventEmitter<EventMap> {
  emit<K extends OrchestratorEvent["type"]>(
    event: K,
    ...args: [Extract<OrchestratorEvent, { type: K }>]
  ): boolean {
    logger.debug(`Event: ${event}`, { eventData: args[0] });
    return super.emit(event, ...args);
  }

  /** Convenience: emit a typed event by passing the full event object */
  dispatch(event: OrchestratorEvent): void {
    this.emit(event.type as OrchestratorEvent["type"], event as any);
  }
}

/** Singleton event bus for the entire orchestrator */
export const eventBus = new OrchestratorEventBus();
