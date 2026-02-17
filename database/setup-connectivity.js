// Run: node database/setup-connectivity.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(process.cwd(), "database", "connectivity.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening connectivity database:", err.message);
    process.exit(1);
  }
  console.log("Connected to connectivity database.");
});

db.serialize(() => {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS connectivity_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      severity TEXT NOT NULL,
      effective_type TEXT,
      downlink REAL,
      rtt INTEGER,
      failures INTEGER DEFAULT 0,
      offline INTEGER DEFAULT 0,
      reported_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connectivity_reports_time ON connectivity_reports(reported_at);
    CREATE INDEX IF NOT EXISTS idx_connectivity_reports_latlng ON connectivity_reports(lat, lng);
    `,
    (err) => {
      if (err) {
        console.error("Error creating connectivity tables:", err.message);
      } else {
        console.log("Connectivity tables ready.");
      }
      db.close();
    }
  );
});
