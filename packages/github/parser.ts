export interface ParsedGithubRepo {
  owner: string;
  repo: string;
}

export function parseGithubUrl(url: string): ParsedGithubRepo {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.hostname !== "github.com") {
    throw new Error("Only GitHub repositories are supported.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error("Invalid GitHub repository URL.");
  }

  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");

  return {
    owner,
    repo,
  };
}
