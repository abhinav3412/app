// Database connection utility
// Choose one based on your database preference

// Option 1: SQLite (for development - no server needed)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function getSQLiteDB() {
  if (!db) {
    // MOVE DATABASE OUTSIDE OF PROJECT ROOT
    // This prevents Next.js from watching the DB file and triggering Fast Refresh loops
   const dbPath = path.join(process.cwd(), 'database', 'agf_database.db');


    console.log('Connected to SQLite database at', dbPath);
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      }
    });
    initializeTables(db);
  }
  return db;
}

function initializeTables(db) {
  db.serialize(() => {
    // Service Prices
    db.run(`CREATE TABLE IF NOT EXISTS service_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type VARCHAR(50) UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get("SELECT count(*) as count FROM service_prices", (err, row) => {
      if (!err && row && row.count === 0) {
        const defaults = [
          ['petrol', 100],
          ['diesel', 100],
          ['crane', 1500],
          ['mechanic_bike', 500],
          ['mechanic_car', 1200]
        ];
        const stmt = db.prepare("INSERT INTO service_prices (service_type, amount) VALUES (?, ?)");
        defaults.forEach(d => stmt.run(d));
        stmt.finalize();
      }
    });

    // Platform Settings
    db.run(`CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      delivery_fee_base INTEGER DEFAULT 50,
      platform_service_fee_percentage REAL DEFAULT 5,
      surge_enabled INTEGER DEFAULT 1,
      surge_night_start VARCHAR(5) DEFAULT '21:00',
      surge_night_end VARCHAR(5) DEFAULT '06:00',
      surge_night_multiplier REAL DEFAULT 1.5,
      surge_rain_multiplier REAL DEFAULT 1.3,
      surge_emergency_multiplier REAL DEFAULT 2.0,
      platform_margin_target_percentage REAL DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("INSERT OR IGNORE INTO platform_settings (id) VALUES (1)");

    // Worker Payouts
    db.run(`CREATE TABLE IF NOT EXISTS worker_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reference_id VARCHAR(100),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    )`);

    // Fuel Stations tables are handled by database/migrate-fuel-stations.js
  });
}

// Option 2: MySQL (uncomment if using MySQL)
/*
const mysql = require('mysql2/promise');

async function getMySQLDB() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agf_database'
  });
}
*/

// Option 3: PostgreSQL (uncomment if using PostgreSQL)
/*
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agf_database',
  port: process.env.DB_PORT || 5432
});

function getPostgreSQLDB() {
  return pool;
}
*/

/** Returns current server local time as "YYYY-MM-DD HH:MM:SS" for storing in DB so display matches when the action happened. */
function getLocalDateTimeString(dateObj = new Date()) {
  const d = dateObj;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/** Returns current UTC time as "YYYY-MM-DD HH:MM:SS" for storing in DB to avoid timezone issues. */
function getUTCDateTimeString(dateObj = new Date()) {
  const d = dateObj;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

// Export based on your choice
module.exports = {
  getDB: getSQLiteDB, // Change to getMySQLDB or getPostgreSQLDB as needed
  getLocalDateTimeString,
  getUTCDateTimeString,
  // For async MySQL/PostgreSQL:
  // getDB: getMySQLDB,
  // getDB: getPostgreSQLDB,
};
