const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

const DB_PATH = path.join(DB_DIR, 'newsbot.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // ইউজার টেবিল — language কলাম যোগ করা হয়েছে
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id TEXT PRIMARY KEY,
      is_subscribed INTEGER DEFAULT 1,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // নোটিফিকেশন ট্র্যাকিং
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      event_id TEXT PRIMARY KEY,
      type TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, runQuery, getQuery, allQuery };
