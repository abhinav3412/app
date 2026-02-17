// Separate SQLite DB for connectivity telemetry (crowdsourced zones)
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

let db;

function getConnectivityDB() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'database', 'connectivity.db');
;
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening connectivity database:", err.message);
      } else {
        console.log("Connected to connectivity database at", dbPath);
      }
    });
  }
  return db;
}

module.exports = {
  getConnectivityDB,
};
