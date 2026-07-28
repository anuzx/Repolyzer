import { Router } from "express";
import { addRepo , getAllRepos , getRepoById , deleteRepo} from "../controllers/repos.controllers";

const router = Router();

router.post("/", addRepo);
router.get("/", getAllRepos)
router.get("/:repoId" , getRepoById)
router.delete("/:repoId", deleteRepo)

export default router;
