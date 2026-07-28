import { z } from "zod";

export const GithubUrlSchema = z.object({
  githubUrl: z
    .string()
    .regex(
      /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/,
      "Invalid GitHub repository URL",
    ),
});
