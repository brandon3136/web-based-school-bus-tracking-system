import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushState {
  isSupported: boolean;
  permission: NotificationPermission | "unknown";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotification() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    permission: "unknown",
    isSubscribed: false,
    isLoading: false,
    error: null,
  });
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  // Check support and current subscription status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    setState(prev => ({
      ...prev,
      isSupported: supported,
      permission: supported ? Notification.permission : "unknown",
    }));

    if (!supported) return;

    // Register service worker and check subscription
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        registrationRef.current = registration;

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;

        // Check existing subscription
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          subscriptionRef.current = subscription;
          setState(prev => ({ ...prev, isSubscribed: true }));
        }
      } catch (err) {
        console.error("Service worker registration failed:", err);
        setState(prev => ({ ...prev, error: "Failed to register service worker" }));
      }
    })();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!registrationRef.current) {
      setState(prev => ({ ...prev, error: "Service worker not ready" }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== "granted") {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: permission === "denied"
            ? "Notification permission denied. Enable notifications in your browser settings."
            : "Notification permission not granted.",
        }));
        return;
      }

      // Get VAPID public key from server
      const keyRes = await fetch(`${API_URL}/api/push/vapid-key`);
      const { publicKey } = await keyRes.json();

      if (!publicKey) {
        setState(prev => ({ ...prev, isLoading: false, error: "Push notifications not configured on server" }));
        return;
      }

      // Subscribe to push
      const subscription = await registrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      subscriptionRef.current = subscription;

      // Send subscription to backend
      const res = await apiFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        throw new Error("Failed to save subscription on server");
      }

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
    } catch (err: any) {
      console.error("Push subscription failed:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to subscribe to push notifications",
      }));
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (subscriptionRef.current) {
        // Send unsubscribe to backend
        await apiFetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscriptionRef.current.endpoint }),
        });

        // Unsubscribe from push manager
        await subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
    } catch (err: any) {
      console.error("Push unsubscribe failed:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to unsubscribe",
      }));
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
