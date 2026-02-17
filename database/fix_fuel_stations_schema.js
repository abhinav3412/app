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

async function fixSchema() {
    try {
        console.log("Checking fuel_stations schema...");

        // 1. Add user_id if missing
        try {
            await run(`ALTER TABLE fuel_stations ADD COLUMN user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE`);
            console.log("✓ Added user_id column");
        } catch (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("  - user_id already exists");
            } else {
                console.error("  ! Error adding user_id:", err.message);
            }
        }

        // 2. Add other potential missing columns from the main migration that might have been skipped
        const cols = [
            "station_name VARCHAR(255)",
            "email VARCHAR(255) UNIQUE",
            "phone_number VARCHAR(20)",
            "address TEXT",
            "latitude REAL",
            "longitude REAL",
            "cod_enabled INTEGER DEFAULT 1",
            "cod_current_balance REAL DEFAULT 0",
            "cod_balance_limit REAL DEFAULT 50000",
            "is_verified INTEGER DEFAULT 0",
            "is_open INTEGER DEFAULT 1",
            "platform_trust_flag INTEGER DEFAULT 0",
            "total_earnings REAL DEFAULT 0",
            "pending_payout REAL DEFAULT 0",
            "last_stock_update DATETIME"
        ];

        for (const colDef of cols) {
            const colName = colDef.split(" ")[0];
            try {
                await run(`ALTER TABLE fuel_stations ADD COLUMN ${colDef}`);
                console.log(`✓ Added ${colName}`);
            } catch (err) {
                if (!err.message.includes("duplicate column name")) {
                    // Ignore duplicates, log real errors
                    console.error(`  ! Error adding ${colName}:`, err.message);
                }
            }
        }

        // 3. Create index for user_id if it doesn't exist
        try {
            await run("CREATE INDEX IF NOT EXISTS idx_fuel_stations_user_id ON fuel_stations(user_id)");
            console.log("✓ Index idx_fuel_stations_user_id checked/created");
        } catch (err) {
            console.error("Index error:", err.message);
        }

        console.log("\nFix complete.");

    } catch (err) {
        console.error("Fix error:", err);
    } finally {
        db.close();
    }
}

fixSchema();
