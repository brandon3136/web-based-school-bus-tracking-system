export type UserRole = "parent" | "admin" | "driver";

export interface JwtPayload {
  userId: number;
  role:   UserRole;
  email:  string;
}

export interface User {
  id:         number;
  name:       string;
  email:      string;
  role:       UserRole;
  phone?:     string;
  is_active:  boolean;
  created_at: Date;
}

export interface Bus {
  id:           number;
  plate_number: string;
  model?:       string;
  capacity:     number;
  driver_id?:   number;
  is_active:    boolean;
}

export interface Stop {
  id:                 number;
  route_id:           number;
  name:               string;
  latitude:           number;
  longitude:          number;
  stop_order:         number;
  geofence_radius_m:  number;
}

export interface Trip {
  id:         number;
  bus_id:     number;
  route_id:   number;
  driver_id:  number;
  started_at: Date | null;
  ended_at:   Date | null;
  status:     "scheduled" | "in_progress" | "completed" | "cancelled";
}

export interface GpsLog {
  id:          number;
  trip_id:     number;
  bus_id:      number;
  latitude:    number;
  longitude:   number;
  speed_kmh:   number;
  heading_deg: number;
  logged_at:   Date;
}

export interface BoardingRecord {
  id:          number;
  trip_id:     number;
  student_id:  number;
  stop_id?:    number;
  boarded_at:  Date;
  alighted_at: Date | null;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth:   string;
  };
}

// Socket.io event payloads
export interface GpsUpdatePayload {
  tripId:     number;
  busId:      number;
  latitude:   number;
  longitude:  number;
  speedKmh:   number;
  headingDeg: number;
}

export interface EmergencyAlertPayload {
  alertId:   number;
  tripId:    number;
  busId:     number;
  driverId:  number;
  driverName:string;
  latitude?: number;
  longitude?:number;
  message:   string;
  timestamp: string;
}
