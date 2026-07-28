import type { Request, Response } from "express";
import { GithubUrlSchema } from "@repo/common";
import { ApiError } from "../utils/ApiError";

const addRepo = async (req: Request, res: Response) => {
  const { data, success } = GithubUrlSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, "invalid input");
  }

  const { githubUrl } = data;
};

const getAllRepos = (req: Request, res: Response) => {};

const getRepoById = (req: Request, res: Response) => {};

const deleteRepo = (req: Request, res: Response) => {};
export { addRepo, getAllRepos, getRepoById, deleteRepo };
