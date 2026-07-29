import simpleGit from "simple-git";

const git = simpleGit();

export async function cloneRepository(
  cloneUrl: string,
  destination: string,
) {
  await git.clone(cloneUrl, destination);
}