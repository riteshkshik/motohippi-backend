try {
  process.loadEnvFile();
} catch {
  // .env file is optional in production containers (Railway, EC2, Render)
}

import app from "./app.js";
import { logger } from "./lib/logger.js";

const port = Number(process.env["PORT"] ?? 3000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

app.listen(port, "0.0.0.0", () => {
  logger.info({ port, host: "0.0.0.0" }, "MotoHippi API server listening");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — not crashing");
});
