const { getDB } = require('./db');

async function migrate() {
    const db = getDB();

    console.log("Starting Worker Payouts & Bank Verification Migration...");

    db.serialize(() => {
        // 1. Worker Bank Details Table
        db.run(`CREATE TABLE IF NOT EXISTS worker_bank_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id INTEGER NOT NULL UNIQUE,
            account_holder_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            ifsc_code TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            is_bank_verified INTEGER DEFAULT 0, -- 0: pending, 1: verified, 2: rejected
            razorpay_contact_id TEXT,
            razorpay_fund_account_id TEXT,
            rejection_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creating worker_bank_details:", err);
            else console.log("Table worker_bank_details ensured.");
        });

        // 2. Payout Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS payout_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id INTEGER NOT NULL,
            payout_id TEXT UNIQUE, -- Razorpay Payout ID
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'INR',
            status TEXT DEFAULT 'processing', -- processing, processed, reversed, failed
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (worker_id) REFERENCES workers(id)
        )`, (err) => {
            if (err) console.error("Error creating payout_logs:", err);
            else console.log("Table payout_logs ensured.");
        });

        // 3. Add balance tracking to workers if not exists (checked schema, floater_cash exists but we need a 'withdrawable_balance' or similar)
        // Wait, 'floater_cash' is what they OWE the platform. 
        // We need a 'pending_payout' or 'balance' column for what the platform OWES them.
        db.run(`ALTER TABLE workers ADD COLUMN pending_balance REAL DEFAULT 0.0`, (err) => {
            if (err) {
                if (err.message.includes("duplicate column name")) {
                    console.log("Column pending_balance already exists.");
                } else {
                    console.error("Error adding pending_balance column:", err);
                }
            } else {
                console.log("Column pending_balance added to workers.");
            }
        });

        db.run(`ALTER TABLE workers ADD COLUMN last_payout_at DATETIME`, (err) => {
            if (err && !err.message.includes("duplicate column name")) {
                console.error("Error adding last_payout_at column:", err);
            }
        });

        console.log("Migration finished.");
    });
}

migrate().catch(console.error);
