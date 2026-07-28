import { Worker } from "bullmq";
import { redisConnection } from "@repo/queue";

const worker = new Worker(
  "repository-processing",

  async (job) => {
    console.log(job.data);

    // clone repo
    // parse files
    // create embeddings
    // store vectors
  },

  {
    connection: redisConnection,
  },
);
