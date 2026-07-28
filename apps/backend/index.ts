import express from "express";

const app = express();

app.use(express.json());

import repoRouter from "./routes/repos.routes";

app.use("/api/repo", repoRouter);

app.listen(3000, () => console.log("server running at port 3000"));
