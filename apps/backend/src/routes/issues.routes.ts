import { Router } from "express";
import { getIssues, getIssueByNumber } from "../controllers/issues.controllers";
import { startIssueChat } from "../controllers/chat.controllers";

const router = Router();

router.get("/:repoId/issues", getIssues);
router.get("/:repoId/issues/:issueNumber", getIssueByNumber);
router.post("/:repoId/issues/:issueNumber/chat", startIssueChat);

export default router;
