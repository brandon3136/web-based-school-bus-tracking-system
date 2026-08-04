/// <reference lib="webworker" />

// SafeRoute Service Worker — handles push notifications and background events

const SW_VERSION = "saferoute-sw-v1";

// Install event — activate immediately
self.addEventListener("install", (event) => {
  console.log(`[${SW_VERSION}] Service worker installed`);
  self.skipWaiting();
});

// Activate event — claim all clients
self.addEventListener("activate", (event) => {
  console.log(`[${SW_VERSION}] Service worker activated`);
  event.waitUntil(self.clients.claim());
});

// Push event — show notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SafeRoute", body: event.data.text() };
  }

  const { title, body, data, icon, badge } = payload;

  const notificationOptions = {
    body: body || "",
    icon: icon || "/icon-192.png",
    badge: badge || "/badge-72.png",
    data: data || {},
    tag: data?.type ? `saferoute-${data.type}` : "saferoute-default",
    renotify: true,
    vibrate: [100, 50, 100],
    actions: getActionsForType(data?.type),
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title || "SafeRoute", notificationOptions)
  );
});

// Notification click — open relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/";

  // Determine target URL based on notification type
  switch (data.type) {
    case "proximity":
      targetUrl = "/dashboard/parent";
      break;
    case "boarding":
      targetUrl = "/dashboard/parent";
      break;
    case "arrival":
      targetUrl = "/dashboard/parent";
      break;
    case "emergency":
      targetUrl = "/dashboard/admin";
      break;
    default:
      targetUrl = "/";
  }

  // If action button was clicked, handle specific actions
  if (event.action === "view-map") {
    targetUrl = "/dashboard/parent";
  } else if (event.action === "dismiss") {
    return; // Just close the notification
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  // Could track analytics here
});

// Helper: get notification actions based on type
function getActionsForType(type) {
  switch (type) {
    case "proximity":
      return [
        { action: "view-map", title: "View Map" },
        { action: "dismiss", title: "Dismiss" },
      ];
    case "boarding":
      return [
        { action: "view-map", title: "View Map" },
      ];
    case "emergency":
      return [
        { action: "view-map", title: "View Details" },
      ];
    default:
      return [];
  }
}
