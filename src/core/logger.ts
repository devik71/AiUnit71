import winston from "winston";
import path from "node:path";

const LOG_DIR = process.env.AIUNIT71_LOG_DIR || "./logs";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "aiunit71" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, roomId, agentId, costUsd, ...rest }) => {
          let prefix = `${timestamp} [${level}]`;
          if (roomId) prefix += ` [room:${roomId}]`;
          if (agentId) prefix += ` [agent:${agentId}]`;
          let suffix = "";
          if (costUsd !== undefined) suffix = ` | cost: $${Number(costUsd).toFixed(6)}`;
          const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
          return `${prefix} ${message}${suffix}${extra}`;
        })
      ),
    }),
  ],
});

/** Create a child logger scoped to a specific room */
export function roomLogger(roomId: string) {
  return logger.child({ roomId });
}

/** Create a child logger scoped to a specific agent */
export function agentLogger(agentId: string, roomId: string) {
  return logger.child({ agentId, roomId });
}
