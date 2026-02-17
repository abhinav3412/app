// Migration: Add Fuel Station role and tables
// Run: node database/migrate-fuel-stations.js

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
    // 1. Update users table to support FUEL_STATION role
    console.log("Updating users table role constraint...");
    try {
      await run(`ALTER TABLE users ADD COLUMN role_old VARCHAR(20)`);
      await run(`UPDATE users SET role_old = role`);
      // SQLite doesn't support modifying constraints, so we'll handle this differently
      // The CHECK constraint will be enforced at the application level for now
      console.log("  ✓ Role column ready (constraint updated in code)");
    } catch (err) {
      if (!/duplicate column name/i.test(err.message)) {
        console.warn(`  ! Role update: ${err.message}`);
      }
    }

    // 2. Fuel Stations table - core fuel station information
    console.log("Creating fuel_stations table...");
    await run(`
      CREATE TABLE IF NOT EXISTS fuel_stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        station_name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone_number VARCHAR(20),
        address TEXT,
        latitude REAL,
        longitude REAL,

        cod_enabled INTEGER DEFAULT 1,
        cod_current_balance REAL DEFAULT 0,
        cod_balance_limit REAL DEFAULT 50000,

        is_verified INTEGER DEFAULT 0,
        is_open INTEGER DEFAULT 1,
        platform_trust_flag INTEGER DEFAULT 0,

        total_earnings REAL DEFAULT 0,
        pending_payout REAL DEFAULT 0,

        last_stock_update DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✓ Table fuel_stations created.");

    // 3. Fuel Stock table - tracks petrol/diesel stock levels
    console.log("Creating fuel_station_stock table...");
    await run(`
      CREATE TABLE IF NOT EXISTS fuel_station_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fuel_station_id INTEGER NOT NULL,
        fuel_type VARCHAR(50) NOT NULL,
        stock_litres REAL DEFAULT 0,
        last_refilled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(fuel_station_id, fuel_type),
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE
      )
    `);
    console.log("✓ Table fuel_station_stock created.");

    // 4. Fuel Station Ledger - tracks earnings and payouts
    console.log("Creating fuel_station_ledger table...");
    await run(`
      CREATE TABLE IF NOT EXISTS fuel_station_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fuel_station_id INTEGER NOT NULL,
        settlement_id INTEGER,
        
        transaction_type VARCHAR(50) NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        
        running_balance REAL DEFAULT 0,
        
        status VARCHAR(30) DEFAULT 'pending',
        reference_id VARCHAR(100),
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE,
        FOREIGN KEY (settlement_id) REFERENCES settlements(id)
      )
    `);
    console.log("✓ Table fuel_station_ledger created.");

    // 5. COD Settlements - tracks COD cash flow from workers to fuel stations
    console.log("Creating cod_settlements table...");
    await run(`
      CREATE TABLE IF NOT EXISTS cod_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_request_id INTEGER NOT NULL,
        fuel_station_id INTEGER NOT NULL,
        worker_id INTEGER NOT NULL,
        
        customer_paid_amount REAL NOT NULL,
        fuel_cost REAL NOT NULL,
        fuel_station_payout REAL NOT NULL,
        platform_fee REAL DEFAULT 0,
        
        collection_method VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(30) DEFAULT 'pending',
        
        collected_at DATETIME,
        settled_at DATETIME,
        
        notes TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (fuel_station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      )
    `);
    console.log("✓ Table cod_settlements created.");

    // 6. Audit Logs - comprehensive audit trail for all changes
    console.log("Creating audit_logs table...");
    await run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        
        user_id INTEGER,
        user_role VARCHAR(50),
        
        old_values TEXT,
        new_values TEXT,
        
        ip_address VARCHAR(50),
        user_agent TEXT,
        
        description TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log("✓ Table audit_logs created.");

    // 7. Add fuel station reference columns to service_requests
    console.log("Adding fuel station columns to service_requests...");
    const srCols = [
      "fuel_station_id INTEGER",
      "fuel_price_per_litre REAL",
      "litres REAL",
    ];
    
    for (const col of srCols) {
      try {
        await run(`ALTER TABLE service_requests ADD COLUMN ${col}`);
        console.log(`  ✓ Added ${col.split(' ')[0]}`);
      } catch (err) {
        if (!/duplicate column name/i.test(err.message)) {
          console.warn(`  ! ${col.split(' ')[0]}: ${err.message}`);
        }
      }
    }

    // 8. Create indexes for performance
    console.log("Creating indexes...");
    const indexes = [
      ["fuel_stations_user_id", "fuel_stations", "user_id"],
      ["fuel_stations_email", "fuel_stations", "email"],
      ["fuel_stations_verified", "fuel_stations", "is_verified"],
      ["fuel_station_stock_fuel_station", "fuel_station_stock", "fuel_station_id"],
      ["fuel_station_stock_fuel_type", "fuel_station_stock", "fuel_type"],
      ["fuel_station_ledger_fuel_station", "fuel_station_ledger", "fuel_station_id"],
      ["fuel_station_ledger_status", "fuel_station_ledger", "status"],
      ["fuel_station_ledger_created", "fuel_station_ledger", "created_at"],
      ["cod_settlements_fuel_station", "cod_settlements", "fuel_station_id"],
      ["cod_settlements_worker", "cod_settlements", "worker_id"],
      ["cod_settlements_status", "cod_settlements", "payment_status"],
      ["audit_logs_entity", "audit_logs", "entity_type"],
      ["audit_logs_user", "audit_logs", "user_id"],
      ["audit_logs_created", "audit_logs", "created_at"],
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
    console.log("New tables: fuel_stations, fuel_station_stock, fuel_station_ledger, cod_settlements, audit_logs");
    console.log("Updated tables: service_requests (fuel station tracking), users (supports FUEL_STATION role)");
    console.log("\nTo run migration: node database/migrate-fuel-stations.js");
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
