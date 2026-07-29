import express from "express";
import type { Request, Response, NextFunction } from "express";
import { ApiError } from "./utils/ApiError";

const app = express();

app.use(express.json());

import repoRouter from "./routes/repos.routes";

app.use("/api/repo", repoRouter);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message, statusCode: err.statusCode });
  }

  console.error(err);
  return res
    .status(500)
    .json({ success: false, message: "Internal server error", statusCode: 500 });
});

app.listen(3000, () => console.log("server running at port 3000"));
