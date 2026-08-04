import webpush from "web-push";
import pool from "../config/db";

// Configure VAPID on startup
export function initWebPush(): void {
  const publicKey  = process.env.VAPID_PUBLIC_KEY  || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const email      = process.env.VAPID_EMAIL        || "mailto:admin@school.tz";

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
    console.log("✅ Web Push VAPID configured");
  } else {
    console.warn("⚠️  VAPID keys not set — push notifications disabled");
  }
}

interface PushPayload {
  title: string;
  body:  string;
  data?: unknown;
}

async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const [rows] = await pool.query(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (?)",
    [userIds]
  );
  const subs = rows as Array<{ endpoint: string; p256dh: string; auth: string }>;

  const notification = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification
      ).catch(err => {
        console.error("Push failed for endpoint:", sub.endpoint, err.statusCode);
        // If subscription expired, remove it
        if (err.statusCode === 410) {
          pool.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [sub.endpoint]);
        }
      })
    )
  );
}

// Send push to all admins
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
  const ids = (rows as Array<{ id: number }>).map(r => r.id);
  if (ids.length) await sendPushToUsers(ids, payload);
}

// Send push to a specific parent
export async function sendPushToParent(parentId: number, payload: PushPayload): Promise<void> {
  await sendPushToUsers([parentId], payload);
}
