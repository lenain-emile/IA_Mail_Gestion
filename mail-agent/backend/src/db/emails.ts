import pool from "./client";
import type { PoolClient } from "pg";
import type { RawEmail, EmailAnalysis } from "../agents/reader";
import type { EmailDraft } from "../agents/writer";
import type { OrchestratorReport } from "../agents/orchestrator";
import logger from "../utils/logger";

const VALID_TYPES = [
  "candidature",
  "relance_candidature",
  "demande_info",
  "partenaire",
  "urgent",
  "spam",
  "notification",
  "autre",
] as const;

const VALID_URGENCES = ["urgent", "normal", "faible"] as const;
const VALID_TONS = ["formel", "bienveillant", "direct"] as const;
const VALID_CONFIANCES = ["haute", "moyenne", "faible"] as const;

type PersistedType = (typeof VALID_TYPES)[number];
type PersistedUrgence = (typeof VALID_URGENCES)[number];
type PersistedTon = (typeof VALID_TONS)[number];
type PersistedConfiance = (typeof VALID_CONFIANCES)[number];

function asType(value: unknown): PersistedType {
  return VALID_TYPES.includes(value as PersistedType)
    ? (value as PersistedType)
    : "autre";
}

function asUrgence(value: unknown): PersistedUrgence {
  return VALID_URGENCES.includes(value as PersistedUrgence)
    ? (value as PersistedUrgence)
    : "normal";
}

function asTon(value: unknown): PersistedTon {
  return VALID_TONS.includes(value as PersistedTon)
    ? (value as PersistedTon)
    : "formel";
}

function asConfiance(value: unknown): PersistedConfiance {
  return VALID_CONFIANCES.includes(value as PersistedConfiance)
    ? (value as PersistedConfiance)
    : "moyenne";
}

function assertEmailId(email: RawEmail): string {
  if (!email.id || typeof email.id !== "string") {
    throw new Error("email.id manquant pour la persistence du brouillon");
  }
  return email.id;
}

async function upsertEmailBaseTx(client: PoolClient, email: RawEmail): Promise<string> {
  const emailId = assertEmailId(email);

  await client.query(
    `
    INSERT INTO emails (id, subject, sender, received_at, body_preview)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET
      subject     = EXCLUDED.subject,
      sender      = EXCLUDED.sender,
      received_at = COALESCE(EXCLUDED.received_at, emails.received_at),
      body_preview= COALESCE(NULLIF(EXCLUDED.body_preview, ''), emails.body_preview)
    `,
    [
      emailId,
      email.subject,
      email.from,
      email.date || null,
      (email.body ?? "").slice(0, 500),
    ]
  );

  return emailId;
}

async function replaceDraftTx(
  client: PoolClient,
  emailId: string,
  draft: EmailDraft,
  sent: boolean
): Promise<void> {
  await client.query(
    `
    INSERT INTO drafts (
      email_id, sujet, corps, ton, confiance, note,
      sent, send_in_progress, sent_at, gmail_message_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,CASE WHEN $7 THEN NOW() ELSE NULL END,NULL)
    ON CONFLICT (email_id) DO UPDATE SET
      sujet            = EXCLUDED.sujet,
      corps            = EXCLUDED.corps,
      ton              = EXCLUDED.ton,
      confiance        = EXCLUDED.confiance,
      note             = EXCLUDED.note,
      sent             = EXCLUDED.sent,
      send_in_progress = FALSE,
      sent_at          = EXCLUDED.sent_at,
      gmail_message_id = NULL
    `,
    [emailId, draft.sujet, draft.corps, draft.ton, draft.confiance, draft.note, sent]
  );
}

// Sauvegarder un email + son analyse + brouillon dans une transaction
export async function saveEmailResult(
  email: RawEmail,
  analysis: EmailAnalysis,
  draft: EmailDraft | null
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const emailId = assertEmailId(email);

    // Sauvegarder l'email et l'analyse
    await client.query(
      `
      INSERT INTO emails (
        id, subject, sender, received_at, body_preview,
        type, urgence, intention, resume, transmitted, raison
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        type        = EXCLUDED.type,
        urgence     = EXCLUDED.urgence,
        intention   = EXCLUDED.intention,
        resume      = EXCLUDED.resume,
        transmitted = EXCLUDED.transmitted,
        raison      = EXCLUDED.raison
      `,
      [
        emailId,
        email.subject,
        email.from,
        email.date || null,
        (email.body ?? "").slice(0, 500),
        analysis.type,
        analysis.urgence,
        analysis.intention,
        analysis.resume,
        analysis.transmettre_au_redacteur,
        analysis.raison_transmission,
      ]
    );

    // Sauvegarder le brouillon si présent
    if (draft) {
      await replaceDraftTx(client, emailId, draft, false);
    }

    await client.query("COMMIT");
    logger.info(`[DB] Email + brouillon sauvegardés : ${emailId}`);

  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`[DB] Transaction annulée : ${error}`);
    throw error;

  } finally {
    client.release();
  }
}

// Sauvegarder une session
export async function saveSession(report: OrchestratorReport): Promise<void> {
  await pool.query(
    `
    INSERT INTO sessions (session_id, total_emails, emails_traites, emails_ignores, resume_session)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (session_id) DO UPDATE SET
      total_emails   = EXCLUDED.total_emails,
      emails_traites = EXCLUDED.emails_traites,
      emails_ignores = EXCLUDED.emails_ignores,
      resume_session = EXCLUDED.resume_session
    `,
    [
      report.session_id,
      report.total_emails,
      report.emails_traites,
      report.emails_ignores,
      report.resume_session,
    ]
  );
  logger.info(`[DB] Session sauvegardée : ${report.session_id}`);
}

// Récupérer l'historique
export async function getEmailHistory(limit: number = 20) {
  const result = await pool.query(
    `
    SELECT e.*, d.sujet as draft_sujet, d.corps as draft_corps, d.confiance
    FROM emails e
    LEFT JOIN drafts d ON d.email_id = e.id
    ORDER BY e.created_at DESC
    LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export async function saveOrReplaceDraft(
  email: RawEmail,
  draft: EmailDraft
): Promise<EmailDraft> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const emailId = await upsertEmailBaseTx(client, email);

    const upsert = await client.query(
      `
      INSERT INTO drafts (
        email_id, sujet, corps, ton, confiance, note,
        sent, send_in_progress, sent_at, gmail_message_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,NULL,NULL)
      ON CONFLICT (email_id) DO UPDATE SET
        sujet     = EXCLUDED.sujet,
        corps     = EXCLUDED.corps,
        ton       = EXCLUDED.ton,
        confiance = EXCLUDED.confiance,
        note      = EXCLUDED.note
      RETURNING sent
      `,
      [emailId, draft.sujet, draft.corps, draft.ton, draft.confiance, draft.note]
    );

    await client.query("COMMIT");

    logger.info(`[DB] Brouillon remplacé : ${emailId}`);
    return { ...draft, sent: Boolean(upsert.rows[0]?.sent) };
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`[DB] Echec remplacement brouillon : ${error}`);
    throw error;
  } finally {
    client.release();
  }
}

export type DraftSendPreparationStatus = "ready" | "already_sent" | "in_progress";

export async function beginDraftSend(
  email: RawEmail,
  draft: EmailDraft
): Promise<DraftSendPreparationStatus> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const emailId = await upsertEmailBaseTx(client, email);

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [emailId]);

    const existing = await client.query<{
      sent: boolean;
      send_in_progress: boolean;
    }>(
      `
      SELECT sent, send_in_progress
      FROM drafts
      WHERE email_id = $1
      FOR UPDATE
      `,
      [emailId]
    );

    if (existing.rows.length === 0) {
      await client.query(
        `
        INSERT INTO drafts (
          email_id, sujet, corps, ton, confiance, note,
          sent, send_in_progress, sent_at, gmail_message_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,FALSE,TRUE,NULL,NULL)
        `,
        [emailId, draft.sujet, draft.corps, draft.ton, draft.confiance, draft.note]
      );
      await client.query("COMMIT");
      return "ready";
    }

    const row = existing.rows[0];
    if (row.sent) {
      await client.query("COMMIT");
      return "already_sent";
    }

    if (row.send_in_progress) {
      await client.query("COMMIT");
      return "in_progress";
    }

    await client.query(
      `
      UPDATE drafts
      SET
        sujet            = $2,
        corps            = $3,
        ton              = $4,
        confiance        = $5,
        note             = $6,
        send_in_progress = TRUE,
        sent             = FALSE,
        sent_at          = NULL,
        gmail_message_id = NULL
      WHERE email_id = $1
      `,
      [emailId, draft.sujet, draft.corps, draft.ton, draft.confiance, draft.note]
    );

    await client.query("COMMIT");
    return "ready";
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`[DB] Echec preparation envoi brouillon : ${error}`);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeDraftSend(
  emailId: string,
  gmailMessageId: string | null
): Promise<void> {
  const result = await pool.query(
    `
    UPDATE drafts
    SET
      sent             = TRUE,
      send_in_progress = FALSE,
      sent_at          = NOW(),
      gmail_message_id = $2
    WHERE email_id = $1
    `,
    [emailId, gmailMessageId]
  );

  if (result.rowCount === 0) {
    throw new Error(`Aucun brouillon à finaliser pour email_id=${emailId}`);
  }

  logger.info(`[DB] Brouillon marqué envoyé : ${emailId}`);
}

export async function releaseDraftSendLock(emailId: string): Promise<void> {
  await pool.query(
    `
    UPDATE drafts
    SET send_in_progress = FALSE
    WHERE email_id = $1
    `,
    [emailId]
  );
}

export async function getSavedEmailResultById(emailId: string): Promise<{
  analysis: EmailAnalysis;
  draft: EmailDraft | null;
} | null> {
  const result = await pool.query(
    `
    SELECT
      e.type,
      e.urgence,
      e.intention,
      e.resume,
      e.transmitted,
      e.raison,
      d.sujet      AS draft_sujet,
      d.corps      AS draft_corps,
      d.ton        AS draft_ton,
      d.confiance  AS draft_confiance,
      d.note       AS draft_note,
      d.sent       AS draft_sent
    FROM emails e
    LEFT JOIN LATERAL (
      SELECT sujet, corps, ton, confiance, note, sent
      FROM drafts
      WHERE email_id = e.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) d ON TRUE
    WHERE e.id = $1
    LIMIT 1
    `,
    [emailId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  const analysis: EmailAnalysis = {
    intention: row.intention || "",
    type: asType(row.type),
    urgence: asUrgence(row.urgence),
    transmettre_au_redacteur: Boolean(row.transmitted),
    raison_transmission: row.raison || "",
    resume: row.resume || "",
    entites: {
      personnes: [],
      dates: [],
      montants: [],
      liens: [],
    },
  };

  const draft: EmailDraft | null = row.draft_sujet
    ? {
        sujet: row.draft_sujet,
        corps: row.draft_corps || "",
        ton: asTon(row.draft_ton),
        confiance: asConfiance(row.draft_confiance),
        note: row.draft_note || "",
        sent: Boolean(row.draft_sent),
      }
    : null;

  return { analysis, draft };
}

// Vérifier si un email a déjà été traité
export async function emailAlreadyProcessed(emailId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM emails WHERE id = $1",
    [emailId]
  );
  return result.rows.length > 0;
}

