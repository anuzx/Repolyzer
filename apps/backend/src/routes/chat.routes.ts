import { Router } from "express";
import { sendMessage, getMessages } from "../controllers/chat.controllers";

const router = Router();

router.route("/:chatId/messages").post(sendMessage).get(getMessages);

export default router;
