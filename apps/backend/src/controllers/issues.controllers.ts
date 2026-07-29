import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { getOpenIssues } from "@repo/github";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

export const getIssues = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;

  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
  });

  if (!repository) {
    throw new ApiError(404, "repository not found");
  }

  let issues = await prisma.githubIssue.findMany({
    where: { repositoryId: repoId },
    orderBy: { githubUpdatedAt: "desc" },
  });

  if (issues.length === 0) {
    const rawIssues = await getOpenIssues(repository.owner, repository.name);

    const data = rawIssues.map((issue: any) => ({
      repositoryId: repoId,
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      labels: issue.labels ?? [],
      author: issue.author,
      state: "open",
      commentsCount: issue.comments,
      url: issue.url,
      githubCreatedAt: new Date(issue.createdAt),
      githubUpdatedAt: new Date(issue.updatedAt),
    }));

    await prisma.githubIssue.createMany({ data, skipDuplicates: true });

    issues = await prisma.githubIssue.findMany({
      where: { repositoryId: repoId },
      orderBy: { githubUpdatedAt: "desc" },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, issues, "issues fetched"));
};

export const getIssueByNumber = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;
  const issueNumber = parseInt(req.params.issueNumber as string, 10);

  if (isNaN(issueNumber)) {
    throw new ApiError(400, "invalid issue number");
  }

  const issue = await prisma.githubIssue.findUnique({
    where: { repositoryId_issueNumber: { repositoryId: repoId, issueNumber } },
  });

  if (!issue) {
    throw new ApiError(404, "issue not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, issue, "issue fetched"));
};
