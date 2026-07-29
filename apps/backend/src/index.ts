import express from "express";
import cors from "cors";
import { globalErrorHandler } from "./middlewares/global_error.middleware";

const app = express();

app.use(cors({ origin: "http://localhost:3001" }));
app.use(express.json());

import repoRouter from "./routes/repos.routes";
import chatRouter from "./routes/chat.routes";
import issueRouter from "./routes/issues.routes";

app.use("/api/repo", repoRouter);
app.use("/api/chats", chatRouter);
app.use("/api/repo", issueRouter);

app.use(globalErrorHandler);

app.listen(3000, () => console.log("server running at port 3000"));
