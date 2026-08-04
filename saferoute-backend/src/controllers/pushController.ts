import { Request, Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { PushSubscription } from "../types";

export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  const sub: PushSubscription = req.body;
  const userId = req.user!.userId;

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
    res.status(201).json({ message: "Subscribed to push notifications" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function unsubscribe(req: AuthRequest, res: Response): Promise<void> {
  const { endpoint } = req.body;
  try {
    await pool.query(
      "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
      [req.user!.userId, endpoint]
    );
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function getVapidPublicKey(_req: Request, res: Response): void {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
