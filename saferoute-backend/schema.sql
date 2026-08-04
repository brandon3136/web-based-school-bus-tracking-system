-- SafeRoute School Bus Tracking System
-- MySQL Database Schema (3NF)

CREATE DATABASE IF NOT EXISTS saferoute CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saferoute;

-- ─────────────────────────────────────────────
-- USERS (parents, admins, drivers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('parent', 'admin', 'driver') NOT NULL,
  phone       VARCHAR(20),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

-- ─────────────────────────────────────────────
-- BUSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  plate_number  VARCHAR(20) NOT NULL UNIQUE,
  model         VARCHAR(80),
  capacity      INT NOT NULL DEFAULT 30,
  driver_id     INT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_driver (driver_id)
);

-- ─────────────────────────────────────────────
-- ROUTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- STOPS (ordered stops per route)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stops (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  route_id      INT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  latitude      DECIMAL(10, 7) NOT NULL,
  longitude     DECIMAL(10, 7) NOT NULL,
  stop_order    INT NOT NULL,
  geofence_radius_m INT DEFAULT 300,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  INDEX idx_route_order (route_id, stop_order)
);

-- ─────────────────────────────────────────────
-- BUS-ROUTE ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_routes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  bus_id    INT NOT NULL,
  route_id  INT NOT NULL,
  FOREIGN KEY (bus_id)   REFERENCES buses(id)  ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bus_route (bus_id, route_id)
);

-- ─────────────────────────────────────────────
-- STUDENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  grade       VARCHAR(20),
  parent_id   INT NOT NULL,
  bus_id      INT,
  route_id    INT,
  stop_id     INT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (bus_id)    REFERENCES buses(id)   ON DELETE SET NULL,
  FOREIGN KEY (route_id)  REFERENCES routes(id)  ON DELETE SET NULL,
  FOREIGN KEY (stop_id)   REFERENCES stops(id)   ON DELETE SET NULL,
  INDEX idx_parent (parent_id),
  INDEX idx_bus    (bus_id),
  INDEX idx_route  (route_id)
);

-- ─────────────────────────────────────────────
-- TRIPS (one record per bus run)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  bus_id        INT NOT NULL,
  route_id      INT NOT NULL,
  driver_id     INT NOT NULL,
  started_at    DATETIME,
  ended_at      DATETIME,
  status        ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id)    REFERENCES buses(id)   ON DELETE CASCADE,
  FOREIGN KEY (route_id)  REFERENCES routes(id)  ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_bus_status (bus_id, status),
  INDEX idx_started    (started_at)
);

-- ─────────────────────────────────────────────
-- GPS LOGS (high-frequency coordinate stream)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gps_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT NOT NULL,
  bus_id      INT NOT NULL,
  latitude    DECIMAL(10, 7) NOT NULL,
  longitude   DECIMAL(10, 7) NOT NULL,
  speed_kmh   DECIMAL(6, 2) DEFAULT 0,
  heading_deg DECIMAL(5, 2) DEFAULT 0,
  logged_at   DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id)  REFERENCES buses(id) ON DELETE CASCADE,
  INDEX idx_trip_time (trip_id, logged_at),
  INDEX idx_bus_time  (bus_id, logged_at)
);

-- ─────────────────────────────────────────────
-- BOARDING RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boarding_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT NOT NULL,
  student_id  INT NOT NULL,
  stop_id     INT,
  boarded_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  alighted_at DATETIME,
  FOREIGN KEY (trip_id)    REFERENCES trips(id)    ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (stop_id)    REFERENCES stops(id)    ON DELETE SET NULL,
  UNIQUE KEY uq_trip_student (trip_id, student_id),
  INDEX idx_trip (trip_id)
);

-- ─────────────────────────────────────────────
-- EMERGENCY ALERTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT NOT NULL,
  driver_id   INT NOT NULL,
  bus_id      INT NOT NULL,
  latitude    DECIMAL(10, 7),
  longitude   DECIMAL(10, 7),
  message     VARCHAR(255) DEFAULT 'Emergency reported by driver',
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id)   REFERENCES trips(id)   ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (bus_id)    REFERENCES buses(id)   ON DELETE CASCADE,
  INDEX idx_resolved (resolved)
);

-- ─────────────────────────────────────────────
-- PUSH SUBSCRIPTIONS (Web Push API)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);

-- ─────────────────────────────────────────────
-- SEED DATA (demo school)
-- ─────────────────────────────────────────────

-- Demo users (passwords are bcrypt of "password123")
INSERT INTO users (name, email, password, role, phone) VALUES
  ('Admin User',   'admin@school.tz',  '$2a$10$Yn5IMKqdOW4CAiUuQnE1huRCwxiEZKoR1KHQiDDB94LfYZyRVlb7.', 'admin',  '+255712000001'),
  ('John Mwenda',  'driver@school.tz', '$2a$10$Yn5IMKqdOW4CAiUuQnE1huRCwxiEZKoR1KHQiDDB94LfYZyRVlb7.', 'driver', '+255712000002'),
  ('Sarah Mwangi', 'parent@school.tz', '$2a$10$Yn5IMKqdOW4CAiUuQnE1huRCwxiEZKoR1KHQiDDB94LfYZyRVlb7.', 'parent', '+255712000003');

INSERT INTO routes (name, description) VALUES
  ('Route 3 – Msasani', 'Msasani Peninsula morning and afternoon route');

INSERT INTO stops (route_id, name, latitude, longitude, stop_order, geofence_radius_m) VALUES
  (1, 'Msasani Junction',    -6.8150, 39.2650, 1, 300),
  (1, 'Oyster Bay Stop',     -6.8050, 39.2750, 2, 300),
  (1, 'Masaki Roundabout',   -6.7950, 39.2850, 3, 300),
  (1, 'School Gate',         -6.7900, 39.2900, 4, 200);

INSERT INTO buses (plate_number, model, capacity, driver_id) VALUES
  ('T 123 DAR', 'Toyota Coaster 2022', 30, 2);

INSERT INTO bus_routes (bus_id, route_id) VALUES (1, 1);

INSERT INTO students (name, grade, parent_id, bus_id, stop_id) VALUES
  ('Jamie Mwangi',  'Grade 5', 3, 1, 1),
  ('Aisha Juma',    'Grade 3', 3, 1, 2);
