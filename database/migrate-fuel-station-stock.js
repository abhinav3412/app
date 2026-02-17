// Migration: Add fuel station stock tracking and COD support
// Run: node database/migrate-fuel-station-stock.js

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
    // 1. Create fuel_station_stock table - tracks petrol/diesel inventory
    console.log("Creating fuel_station_stock table...");
    await run(`
      CREATE TABLE IF NOT EXISTS fuel_station_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fuel_station_id INTEGER NOT NULL,
        fuel_type VARCHAR(50) NOT NULL,
        stock_litres REAL DEFAULT 1000,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id),
        UNIQUE(fuel_station_id, fuel_type)
      )
    `);
    console.log("✓ Table fuel_station_stock ready.");

    // 2. Add columns to fuel_stations table for COD and stock management
    console.log("Adding fuel station configuration columns...");
    const fuelStationCols = [
      "is_open INTEGER DEFAULT 1",
      "cod_supported INTEGER DEFAULT 1",
      "cod_balance_limit REAL DEFAULT 5000",
      "cod_current_balance REAL DEFAULT 0",
      "platform_trust_flag INTEGER DEFAULT 1",
      "max_queue_time_minutes INTEGER DEFAULT 30",
      "average_service_time_minutes INTEGER DEFAULT 5",
      "last_stock_update DATETIME",
      "is_verified INTEGER DEFAULT 0",
    ];

    for (const col of fuelStationCols) {
      try {
        await run(`ALTER TABLE fuel_stations ADD COLUMN ${col}`);
        console.log(`  ✓ Added ${col.split(' ')[0]}`);
      } catch (err) {
        if (!/duplicate column name/i.test(err.message)) {
          console.warn(`  ! ${col.split(' ')[0]}: ${err.message}`);
        }
      }
    }

    // 3. Create worker_station_cache table - caches nearest station assignments
    console.log("Creating worker_station_cache table...");
    await run(`
      CREATE TABLE IF NOT EXISTS worker_station_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        service_request_id INTEGER NOT NULL,
        fuel_station_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        worker_lat REAL,
        worker_lng REAL,
        distance_km REAL,
        is_valid INTEGER DEFAULT 1,
        invalidated_at DATETIME,
        FOREIGN KEY (worker_id) REFERENCES workers(id),
        FOREIGN KEY (service_request_id) REFERENCES service_requests(id),
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id)
      )
    `);
    console.log("✓ Table worker_station_cache ready.");

    // 4. Create fuel_station_assignments table - audit trail for assignments
    console.log("Creating fuel_station_assignments table...");
    await run(`
      CREATE TABLE IF NOT EXISTS fuel_station_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_request_id INTEGER NOT NULL,
        worker_id INTEGER NOT NULL,
        fuel_station_id INTEGER NOT NULL,
        fuel_type VARCHAR(50) NOT NULL,
        litres REAL NOT NULL,
        distance_km REAL NOT NULL,
        is_cod INTEGER DEFAULT 0,
        supports_cod INTEGER DEFAULT 0,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        picked_up_at DATETIME,
        status VARCHAR(30) DEFAULT 'assigned',
        rejection_reason VARCHAR(200),
        reassignment_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_request_id) REFERENCES service_requests(id),
        FOREIGN KEY (worker_id) REFERENCES workers(id),
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id)
      )
    `);
    console.log("✓ Table fuel_station_assignments ready.");

    // 5. Create indexes for performance
    console.log("Creating indexes...");
    const indexes = [
      ["fuel_station_stock_station", "fuel_station_stock", "fuel_station_id"],
      ["fuel_station_stock_type", "fuel_station_stock", "fuel_type"],
      ["worker_station_cache_worker", "worker_station_cache", "worker_id"],
      ["worker_station_cache_request", "worker_station_cache", "service_request_id"],
      ["worker_station_cache_valid", "worker_station_cache", "is_valid"],
      ["fuel_assignments_request", "fuel_station_assignments", "service_request_id"],
      ["fuel_assignments_worker", "fuel_station_assignments", "worker_id"],
      ["fuel_assignments_station", "fuel_station_assignments", "fuel_station_id"],
      ["fuel_assignments_status", "fuel_station_assignments", "status"],
    ];

    for (const [name, table, column] of indexes) {
      try {
        await run(`CREATE INDEX IF NOT EXISTS idx_${name} ON ${table}(${column})`);
        console.log(`  ✓ Index ${name}`);
      } catch (err) {
        console.warn(`  ! Index ${name}: ${err.message}`);
      }
    }

    console.log("\n✅ Migration complete!");
    console.log("New tables: fuel_station_stock, worker_station_cache, fuel_station_assignments");
    console.log("Updated tables: fuel_stations (configuration columns)");
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
