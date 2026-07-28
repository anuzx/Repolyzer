export const GITHUB_API = "https://api.github.com";

export async function getRepository(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    throw new Error("Repository not found");
  }

  return res.json();
}

export async function getBranches(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/branches`
  );

  if (!res.ok) {
    throw new Error("Unable to fetch branches");
  }

  return res.json();
}

export async function getReadme(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/readme`,
    {
      headers: {
        Accept: "application/vnd.github.raw",
      },
    }
  );

  if (!res.ok) {
    throw new Error("unable to fetch readme")
  }

  return res.text();
}

export async function getLanguages(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/languages`
  );

  if (!res.ok) {
    return {};
  }

  return res.json();
}

export async function getContributors(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contributors`
  );

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export async function getLatestCommit(
  owner: string,
  repo: string,
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits`
  );

  if (!res.ok) {
    return null;
  }

  const commits = await res.json();

  return commits[0];
}