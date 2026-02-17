// Database Setup Script
// Run this to initialize your database: npm run setup

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ✅ Use SAME path as app
const agfDbPath = path.join(process.cwd(), 'database', 'agf_database.db');
const connectivityDbPath = path.join(process.cwd(), 'database', 'connectivity.db');

// schema.sql is inside /database
const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');

// Ensure /database folder exists
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Read schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

// Create AGF database and apply schema
const db = new sqlite3.Database(agfDbPath, (err) => {
  if (err) {
    console.error('❌ Error opening AGF DB:', err.message);
    process.exit(1);
  }

  console.log('✅ AGF Database opened at:', agfDbPath);

  db.exec(schema, (execErr) => {
    if (execErr) {
      console.error('❌ Error applying schema:', execErr.message);
      process.exit(1);
    }

    console.log('✅ Schema applied to AGF DB');
    db.close();
  });
});

// ✅ Touch connectivity.db so SQLite creates the file
const connectivityDb = new sqlite3.Database(connectivityDbPath, (err) => {
  if (err) {
    console.error('❌ Error opening connectivity DB:', err.message);
  } else {
    console.log('✅ connectivity.db created at:', connectivityDbPath);
  }
  connectivityDb.close();
});
