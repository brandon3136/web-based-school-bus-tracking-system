"use client";
import { usePushNotification } from "@/hooks/usePushNotification";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useState } from "react";

export default function NotificationBell() {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotification();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isSupported) return null;

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const getIcon = () => {
    if (isLoading) return <Loader2 size={16} className="animate-spin" />;
    if (isSubscribed) return <BellRing size={16} />;
    if (permission === "denied") return <BellOff size={16} />;
    return <Bell size={16} />;
  };

  const getTooltipText = () => {
    if (isLoading) return "Loading...";
    if (isSubscribed) return "Notifications enabled — click to disable";
    if (permission === "denied") return "Notifications blocked — enable in browser settings";
    return "Enable push notifications";
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isLoading || permission === "denied"}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: isSubscribed
            ? "color-mix(in srgb, var(--teal) 15%, transparent)"
            : "var(--surface)",
          color: isSubscribed ? "var(--teal)" : "var(--slate)",
        }}
        aria-label={getTooltipText()}
      >
        {getIcon()}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap z-50 pointer-events-none"
          style={{
            backgroundColor: "var(--text-primary)",
            color: "var(--surface)",
          }}
        >
          {getTooltipText()}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
            style={{ backgroundColor: "var(--text-primary)" }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-lg text-xs max-w-[200px] z-50"
          style={{
            backgroundColor: "var(--danger-light)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
