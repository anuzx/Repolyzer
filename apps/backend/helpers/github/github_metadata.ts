import { ApiError } from "../../utils/ApiError";
import { getRepository } from "./api";
import { parseGithubUrl } from "./parser";

export async function getRepositoryMetadata(url: string) {
  const { owner, repo } = parseGithubUrl(url);

  const repository = await getRepository(owner, repo);

  if (!repository) {
    throw new Error("invalid repository link");
  }

  return {
    owner,
    repo,

    githubUrl: url,

    cloneUrl: repository.clone_url,

    description: repository.description,

    defaultBranch: repository.default_branch,

    stars: repository.stargazers_count,

    forks: repository.forks_count,

    language: repository.language,

    latestCommitSha: repository.pushed_at,
  };
}
