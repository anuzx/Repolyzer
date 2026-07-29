import { Worker } from "bullmq";
import { redisConnection } from "@repo/queue";
import { repositoryProcessor } from "./processors/repository.processor";

const worker = new Worker(
  "repository-processing",

  async (job) => {
    try {
      await repositoryProcessor(job);
    } catch (error) {
      console.log(error);
    }
  },

  {
    connection: redisConnection,
  },
);
