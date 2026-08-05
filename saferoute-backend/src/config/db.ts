import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Managed providers (Aiven, PlanetScale, etc.) require TLS on the connection.
// Set DB_SSL=true to enable it.
// If you have the provider's CA certificate, put its PEM contents in DB_SSL_CA
// (or a file path in DB_SSL_CA_PATH) for full certificate verification.
// Without a CA, we still encrypt the connection but skip verifying the
// server's certificate chain (rejectUnauthorized: false) — good enough to get
// started, but prefer supplying the CA cert for production use.
function buildSslConfig(): mysql.PoolOptions["ssl"] {
  if ((process.env.DB_SSL || "").toLowerCase() !== "true") return undefined;

  if (process.env.DB_SSL_CA) {
    return { ca: process.env.DB_SSL_CA, rejectUnauthorized: true };
  }

  if (process.env.DB_SSL_CA_PATH) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    return { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8"), rejectUnauthorized: true };
  }

  return { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:         parseInt(process.env.DB_PORT  || "3306"),
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "saferoute",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           "+00:00",
  decimalNumbers:     true, // return DECIMAL columns (lat/lng/speed/heading) as JS numbers, not strings
  ssl:                buildSslConfig(),
});

export default pool;