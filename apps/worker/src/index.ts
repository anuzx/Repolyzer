import { Worker } from "bullmq";
import { redisConnection } from "@repo/queue";
import { repositoryProcessor } from "./processors/repository.processor";

const worker = new Worker(
  "repository-processing",
  async (job) => {
    await repositoryProcessor(job);
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});
