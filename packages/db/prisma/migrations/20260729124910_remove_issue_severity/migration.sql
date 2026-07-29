/*
  Warnings:

  - You are about to drop the `Issue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_fileId_fkey";

-- DropForeignKey
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_repositoryId_fkey";

-- DropTable
DROP TABLE "Issue";

-- DropEnum
DROP TYPE "Severity";
