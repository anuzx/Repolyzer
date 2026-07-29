import { Router } from "express";
import { getIssues, getIssueByNumber } from "../controllers/issues.controllers";

const router = Router();

router.get("/:repoId/issues", getIssues);
router.get("/:repoId/issues/:issueNumber", getIssueByNumber);

export default router;
