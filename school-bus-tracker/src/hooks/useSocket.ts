import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
  subscribeBus: (busId: number) => void;
  unsubscribeBus: (busId: number) => void;
  onGpsUpdate: (callback: (data: GpsUpdate) => void) => void;  offGpsUpdate: (callback: (data: GpsUpdate) => void) => void;  onTripStarted: (callback: (data: { tripId: number; busId: number; driverId: number }) => void) => void;
  onTripEnded: (callback: (data: { tripId: number }) => void) => void;
  onEmergencyAlert: (callback: (data: EmergencyAlert) => void) => void;
}

export interface GpsUpdate {
  tripId: number;
  busId: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
}

export interface EmergencyAlert {
  alertId: number;
  tripId: number;
  busId: number;
  driverId: number;
  driverName: string;
  latitude?: number;
  longitude?: number;
  message: string;
  timestamp: string;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbacksRef = useRef<Record<string, Function[]>>({});

  useEffect(() => {
    if (!autoConnect || typeof window === "undefined") return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      console.log("Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("Socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      setError(err.message);
      console.error("Socket connection error:", err.message);
    });

    // Register event listeners
    socket.on("gps:update", (data: GpsUpdate) => {
      callbacksRef.current["gps:update"]?.forEach(cb => cb(data));
    });

    socket.on("trip:started", (data: { tripId: number; busId: number; driverId: number }) => {
      callbacksRef.current["trip:started"]?.forEach(cb => cb(data));
    });

    socket.on("trip:ended", (data: { tripId: number }) => {
      callbacksRef.current["trip:ended"]?.forEach(cb => cb(data));
    });

    socket.on("emergency:alert", (data: EmergencyAlert) => {
      callbacksRef.current["emergency:alert"]?.forEach(cb => cb(data));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      callbacksRef.current = {};
    };
  }, [autoConnect]);

  const subscribeBus = useCallback((busId: number) => {
    socketRef.current?.emit("subscribe:bus", busId);
  }, []);

  const unsubscribeBus = useCallback((busId: number) => {
    socketRef.current?.emit("unsubscribe:bus", busId);
  }, []);

  const addCallback = useCallback((event: string, callback: Function) => {
    if (!callbacksRef.current[event]) callbacksRef.current[event] = [];
    callbacksRef.current[event].push(callback);
  }, []);

  const removeCallback = useCallback((event: string, callback: Function) => {
    const list = callbacksRef.current[event] || [];
    callbacksRef.current[event] = list.filter((cb) => cb !== callback);
  }, []);

  const onGpsUpdate = useCallback((callback: (data: GpsUpdate) => void) => {
    addCallback("gps:update", callback);
  }, [addCallback]);

  const offGpsUpdate = useCallback((callback: (data: GpsUpdate) => void) => {
    removeCallback("gps:update", callback);
  }, [removeCallback]);

  const onTripStarted = useCallback((callback: (data: { tripId: number; busId: number; driverId: number }) => void) => {
    addCallback("trip:started", callback);
  }, [addCallback]);

  const onTripEnded = useCallback((callback: (data: { tripId: number }) => void) => {
    addCallback("trip:ended", callback);
  }, [addCallback]);

  const onEmergencyAlert = useCallback((callback: (data: EmergencyAlert) => void) => {
    addCallback("emergency:alert", callback);
  }, [addCallback]);

  return {
    socket: socketRef.current,
    connected,
    error,
    subscribeBus,
    unsubscribeBus,
    onGpsUpdate,
    offGpsUpdate,
    onTripStarted,
    onTripEnded,
    onEmergencyAlert,
  };
}
