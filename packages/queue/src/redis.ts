import type { ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
};
