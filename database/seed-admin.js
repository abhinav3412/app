// Seed default admin user into the database.
// Run from project root: node database/seed-admin.js
// Admin login: admin@gmail.com / admin123

const path = require("path");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(process.cwd(), "database", "agf_database.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
});

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";
const HASH_ROUNDS = 10;

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, HASH_ROUNDS);

  db.get("SELECT id FROM users WHERE email = ?", [ADMIN_EMAIL], (err, row) => {
    if (err) {
      console.error("Error checking admin:", err.message);
      db.close();
      process.exit(1);
    }
    if (row) {
      db.run(
        "UPDATE users SET password = ?, first_name = 'Admin', last_name = 'User', role = 'Admin', updated_at = datetime('now') WHERE email = ?",
        [hashedPassword, ADMIN_EMAIL],
        (updateErr) => {
          if (updateErr) {
            console.error("Error updating admin:", updateErr.message);
          } else {
            console.log("Admin user updated: admin@gmail.com / admin123");
          }
          db.close();
        }
      );
    } else {
      db.run(
        "INSERT INTO users (email, password, first_name, last_name, phone_number, role) VALUES (?, ?, 'Admin', 'User', '+919000000000', 'Admin')",
        [ADMIN_EMAIL, hashedPassword],
        (insertErr) => {
          if (insertErr) {
            console.error("Error creating admin:", insertErr.message);
          } else {
            console.log("Admin user created: admin@gmail.com / admin123");
          }
          db.close();
        }
      );
    }
  });
}

seedAdmin();
