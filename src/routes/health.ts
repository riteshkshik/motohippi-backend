import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "../lib/api-zod/index.js";
import { pool } from "../lib/db/index.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/db-test", async (_req, res) => {
  try {
    const timeRes = await pool.query("SELECT NOW()");
    let usersCount = -1;
    try {
      const uRes = await pool.query("SELECT count(*) FROM users");
      usersCount = parseInt(uRes.rows[0].count, 10);
    } catch (uErr: any) {
      res.json({
        dbConnected: true,
        now: timeRes.rows[0].now,
        usersTableError: uErr?.message || String(uErr),
      });
      return;
    }
    res.json({
      dbConnected: true,
      now: timeRes.rows[0].now,
      usersCount,
    });
  } catch (err: any) {
    res.status(500).json({
      dbConnected: false,
      error: err?.message || String(err),
    });
  }
});

export default router;
