import { Router } from "express";
import {
  addRepo,
  getAllRepos,
  getRepoById,
  deleteRepo,
  createChat,
  fetchChat,
  retryRepo,
} from "../controllers/repos.controllers";

const router = Router();

router.post("/", addRepo);
router.get("/", getAllRepos);
router.route("/:repoId").get(getRepoById).delete(deleteRepo);

router.route("/:repoId/chats").post(createChat).get(fetchChat);
router.post("/:repoId/retry", retryRepo);

export default router;
