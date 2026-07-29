-- CreateTable
CREATE TABLE "GithubIssue" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "labels" JSONB,
    "author" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "githubCreatedAt" TIMESTAMP(3) NOT NULL,
    "githubUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GithubIssue_repositoryId_idx" ON "GithubIssue"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubIssue_repositoryId_issueNumber_key" ON "GithubIssue"("repositoryId", "issueNumber");

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
