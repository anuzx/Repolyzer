import { Router } from "express";
import { addRepo , getAllRepos , getRepoById , deleteRepo} from "../controllers/repos.controllers";

const router = Router();

router.post("/", addRepo);
router.get("/", getAllRepos)
router.route("/:repoId").get(getRepoById).delete(deleteRepo)

export default router;
