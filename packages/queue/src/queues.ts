import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const repoQueue = new Queue("repository-processing", {
  connection: redisConnection,
});
