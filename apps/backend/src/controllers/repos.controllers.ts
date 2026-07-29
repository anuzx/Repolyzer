import type { Request, Response } from "express";
import { GithubUrlSchema } from "@repo/common";
import { ApiError } from "../utils/ApiError";
import { getRepositoryMetadata } from "@repo/github";
import { prisma } from "@repo/db";
import { ApiResponse } from "../utils/ApiResponse";
import { repoQueue } from "@repo/queue";

const addRepo = async (req: Request, res: Response) => {
  const { data, success } = GithubUrlSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, "invalid input");
  }

  const { githubUrl } = data;

  const metadata = await getRepositoryMetadata(githubUrl);

  const repository = await prisma.repository.create({
    data: { ...metadata },
  });

  await repoQueue.add("analyze-repository", { repositoryId: repository.id });

  return res
    .status(201)
    .json(new ApiResponse(200, repository, "repository created"));
};

const getAllRepos = async (req: Request, res: Response) => {
  const repos = await prisma.repository.findMany({
    orderBy: { createdAt: "desc" },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, repos, "repositories fetched"));
};

const getRepoById = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;

  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
    include: {
      files: {
        select: { path: true, extension: true },
        orderBy: { path: "asc" },
      },
      artifacts: {
        select: { type: true, content: true },
      },
    },
  });

  if (!repository) {
    throw new ApiError(404, "repository not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, repository, "repository fetched"));
};

const deleteRepo = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;

  const existing = await prisma.repository.findUnique({
    where: { id: repoId },
  });

  if (!existing) {
    throw new ApiError(404, "repository not found");
  }

  await prisma.repository.delete({ where: { id: repoId } });

  return res.status(200).json(new ApiResponse(200, null, "repository deleted"));
};

const createChat = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;

  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
  });

  if (!repository) {
    throw new ApiError(404, "repository not found");
  }

  const chat = await prisma.chat.create({
    data: {
      repositoryId: repoId,
      title: req.body.title ?? null,
    },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, chat, "chat created"));
};

const fetchChat = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;

  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
  });

  if (!repository) {
    throw new ApiError(404, "repository not found");
  }

  const chats = await prisma.chat.findMany({
    where: { repositoryId: repoId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, chats, "chats fetched"));
};
export { addRepo, getAllRepos, getRepoById, deleteRepo, createChat, fetchChat };
