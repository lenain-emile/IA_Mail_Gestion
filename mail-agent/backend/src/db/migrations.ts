import pool from "./client";
import logger from "../utils/logger";

export async function runMigrations(): Promise<void> {
  logger.info("[DB] Lancement des migrations");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id            TEXT PRIMARY KEY,
      subject       TEXT NOT NULL,
      sender        TEXT NOT NULL,
      received_at   TIMESTAMPTZ,
      body_preview  VARCHAR(500),
      type          TEXT,
      urgence       TEXT,
      intention     TEXT,
      resume        TEXT,
      transmitted   BOOLEAN DEFAULT FALSE,
      raison        TEXT,
      created_at    TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drafts (
      id          SERIAL PRIMARY KEY,
      email_id    TEXT REFERENCES emails(id) ON DELETE CASCADE,
      sujet       TEXT NOT NULL,
      corps       TEXT NOT NULL,
      ton         TEXT,
      confiance   TEXT,
      note        TEXT,
      sent        BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id              SERIAL PRIMARY KEY,
      session_id      TEXT UNIQUE NOT NULL,
      total_emails    INTEGER,
      emails_traites  INTEGER,
      emails_ignores  INTEGER,
      resume_session  TEXT,
      created_at      TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index pour les requêtes fréquentes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_drafts_email_id ON drafts(email_id);
  `);

  logger.info("[DB] Migrations terminées ✅");
}

