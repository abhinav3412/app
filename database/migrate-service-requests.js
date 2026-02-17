// Migration: Add service_types and service_requests tables to existing database.
// Run: node database/migrate-service-requests.js

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(process.cwd(), "database", "agf_database.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log("Connected to database.");
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function migrate() {
  try {
    // 1. Service types table
    await run(`
      CREATE TABLE IF NOT EXISTS service_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(100) NOT NULL,
        amount INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Table service_types ready.");

    // 2. Seed service types (idempotent)
    const types = [
      ["petrol", "Petrol", 100],
      ["diesel", "Diesel", 150],
      ["crane", "Crane", 200],
      ["mechanic_bike", "Mechanic (Bike)", 300],
      ["mechanic_car", "Mechanic (Car)", 300],
    ];
    for (const [code, label, amount] of types) {
      await run(
        "INSERT OR IGNORE INTO service_types (code, label, amount) VALUES (?, ?, ?)",
        [code, label, amount]
      );
    }
    console.log("Service types seeded (5 rows).");

    // 3. Service requests table (no CHECK on service_type so any code from service_types is valid)
    await run(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        vehicle_number VARCHAR(50) NOT NULL,
        driving_licence VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending' CHECK(status IN ('Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log("Table service_requests ready.");

    // 4. Indexes
    await run("CREATE INDEX IF NOT EXISTS idx_service_types_code ON service_types(code)");
    await run("CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status)");
    await run("CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at)");
    console.log("Indexes created.");

    console.log("Migration complete. service_types and service_requests are in the database.");
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
