import pool from "./client";
import type { RawEmail, EmailAnalysis } from "../agents/reader";
import type { EmailDraft } from "../agents/writer";
import type { OrchestratorReport } from "../agents/orchestrator";
import logger from "../utils/logger";

// Sauvegarder un email + son analyse + brouillon dans une transaction
export async function saveEmailResult(
  email: RawEmail,
  analysis: EmailAnalysis,
  draft: EmailDraft | null
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Sauvegarder l'email
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
        email.id,
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
      await client.query(
        `
        INSERT INTO drafts (email_id, sujet, corps, ton, confiance, note)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [email.id, draft.sujet, draft.corps, draft.ton, draft.confiance, draft.note]
      );
    }

    await client.query("COMMIT");
    logger.info(`[DB] Email + brouillon sauvegardés : ${email.id}`);

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

// Vérifier si un email a déjà été traité
export async function emailAlreadyProcessed(emailId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM emails WHERE id = $1",
    [emailId]
  );
  return result.rows.length > 0;
}

