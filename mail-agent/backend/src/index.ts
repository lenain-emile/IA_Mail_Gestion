import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./utils/logger";
import { analyzeEmail } from "./agents/reader";
import type { RawEmail } from "./agents/reader";
import { writeReply } from "./agents/writer";
import type { EmailDraft } from "./agents/writer";
import { runOrchestrator } from "./agents/orchestrator";
import { runMigrations } from "./db/migrations";
import {
  getSavedEmailResultById,
  saveOrReplaceDraft,
  beginDraftSend,
  completeDraftSend,
  releaseDraftSendLock,
} from "./db/emails";
import {
  getAuthUrl,
  saveToken,
  fetchEmails,
  sendReplyToMessage,
} from "./tools/gmail";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function parseEmailPayload(value: unknown): RawEmail | null {
  const maybe = value as Partial<RawEmail> | null | undefined;

  if (!maybe || typeof maybe !== "object") {
    return null;
  }

  const id = maybe.id;
  const subject = maybe.subject;
  const from = maybe.from;
  const date = maybe.date;
  const body = maybe.body;

  if (
    (typeof id !== "string" && id !== null && id !== undefined) ||
    typeof subject !== "string" ||
    typeof from !== "string" ||
    typeof date !== "string" ||
    typeof body !== "string"
  ) {
    return null;
  }

  return { id, subject, from, date, body };
}

function parseDraftPayload(value: unknown): EmailDraft | null {
  const maybe = value as Partial<EmailDraft> | null | undefined;

  if (!maybe || typeof maybe !== "object") {
    return null;
  }

  if (typeof maybe.sujet !== "string" || typeof maybe.corps !== "string") {
    return null;
  }

  const ton = maybe.ton;
  const confiance = maybe.confiance;

  const safeTon: EmailDraft["ton"] =
    ton === "formel" || ton === "bienveillant" || ton === "direct"
      ? ton
      : "formel";

  const safeConfiance: EmailDraft["confiance"] =
    confiance === "haute" || confiance === "moyenne" || confiance === "faible"
      ? confiance
      : "moyenne";

  return {
    sujet: maybe.sujet,
    corps: maybe.corps,
    ton: safeTon,
    confiance: safeConfiance,
    note: typeof maybe.note === "string" ? maybe.note : "",
  };
}

async function runAnalyzeForEmail(email: RawEmail): Promise<{
  email: RawEmail;
  analysis: Awaited<ReturnType<typeof analyzeEmail>>;
}> {
  const analysis = await analyzeEmail(email);
  return { email, analysis };
}

async function runDraftForEmail(email: RawEmail): Promise<{
  email: RawEmail;
  analysis: Awaited<ReturnType<typeof analyzeEmail>>;
  draft: Awaited<ReturnType<typeof writeReply>> | null;
  message?: string;
}> {
  const analysis = await analyzeEmail(email);

  if (!analysis.transmettre_au_redacteur) {
    return {
      email,
      analysis,
      draft: null,
      message: `Mail ignoré — ${analysis.raison_transmission}`,
    };
  }

  const draft = await writeReply(email, analysis);
  return { email, analysis, draft };
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Étape 1 — Rediriger vers Google
app.get("/auth/login", (req, res) => {
  try {
    const url = getAuthUrl();
    logger.info("Redirection vers Google OAuth");
    res.redirect(url);
  } catch (error) {
    logger.error(`Erreur login OAuth : ${error}`);
    res.status(500).json({
      error: "Impossible de générer l'URL Google OAuth",
      details: String(error),
    });
  }
});

// Alias pratique pour les frontends qui appellent /login
app.get("/login", (req, res) => {
  res.redirect("/auth/login");
});

// Étape 2 — Google redirige ici avec un code
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).json({ error: "Code manquant" });
    return;
  }

  try {
    await saveToken(code);
    res.json({ success: true, message: "Authentification réussie ✅" });
  } catch (error) {
    logger.error(`Erreur auth : ${error}`);
    res.status(500).json({ error: "Erreur lors de l'authentification" });
  }
});

// Test — Récupérer les mails
app.get("/mails", async (req, res) => {
  try {
    const emails = await fetchEmails(5);
    res.json({ count: emails.length, emails });
  } catch (error) {
    logger.error(`Erreur fetch mails : ${error}`);
    res.status(500).json({ error: "Erreur lors de la récupération des mails" });
  }
});

// Récupérer les données sauvegardées (analyse + dernier brouillon) d'un mail
app.get("/mails/:id/saved", async (req, res) => {
  try {
    const emailId = String(req.params.id || "").trim();

    if (!emailId) {
      res.status(400).json({ error: "email_id manquant" });
      return;
    }

    const saved = await getSavedEmailResultById(emailId);

    if (!saved) {
      res.json({ analysis: null, draft: null });
      return;
    }

    res.json(saved);
  } catch (error) {
    logger.error(`Erreur lecture donnees sauvegardees : ${error}`);
    res.status(500).json({ error: "Erreur lors de la lecture des donnees sauvegardees" });
  }
});

// Test — Analyser le premier mail
app.get("/mails/analyze", async (req, res) => {
  try {
    const emails = await fetchEmails(1);

    if (emails.length === 0) {
      res.json({ message: "Aucun mail non lu trouvé" });
      return;
    }

    const payload = await runAnalyzeForEmail(emails[0]);
    res.json(payload);
  } catch (error) {
    logger.error(`Erreur analyze : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

// Analyse du mail sélectionné côté frontend
app.post("/mails/analyze", async (req, res) => {
  try {
    const email = parseEmailPayload(req.body?.email);

    if (!email) {
      res.status(400).json({ error: "Payload email invalide" });
      return;
    }

    const payload = await runAnalyzeForEmail(email);
    res.json(payload);
  } catch (error) {
    logger.error(`Erreur analyze (selected email) : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

async function startServer() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
    });
  } catch (error) {
    logger.error(`[SERVER] Démarrage impossible (DB/migrations) : ${error}`);
    process.exit(1);
  }
}

startServer();

// Test — Lire + Rédiger pour le premier mail
app.get("/mails/draft", async (req, res) => {
  try {
    const emails = await fetchEmails(50);

    if (emails.length === 0) {
      res.json({ message: "Aucun mail non lu trouvé" });
      return;
    }

    const payload = await runDraftForEmail(emails[0]);
    res.json(payload);

  } catch (error) {
    logger.error(`Erreur draft : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

// Rédaction de réponse pour le mail sélectionné côté frontend
app.post("/mails/draft", async (req, res) => {
  try {
    const email = parseEmailPayload(req.body?.email);

    if (!email) {
      res.status(400).json({ error: "Payload email invalide" });
      return;
    }

    const payload = await runDraftForEmail(email);
    res.json(payload);
  } catch (error) {
    logger.error(`Erreur draft (selected email) : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

// Sauvegarder un brouillon édité et remplacer l'ancien
app.put("/mails/:id/draft", async (req, res) => {
  try {
    const emailId = String(req.params.id || "").trim();
    const email = parseEmailPayload(req.body?.email);
    const draft = parseDraftPayload(req.body?.draft);

    if (!emailId || !email || !draft) {
      res.status(400).json({ error: "Payload email/draft invalide" });
      return;
    }

    if (email.id && email.id !== emailId) {
      res.status(400).json({ error: "Incohérence entre email.id et l'URL" });
      return;
    }

    const savedDraft = await saveOrReplaceDraft({ ...email, id: emailId }, draft);

    res.json({
      success: true,
      emailId,
      draft: savedDraft,
      message: "Brouillon sauvegardé",
    });
  } catch (error) {
    logger.error(`Erreur save draft : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

// Envoyer une réponse Gmail dans le thread original puis marquer le brouillon comme envoyé
app.post("/mails/:id/send", async (req, res) => {
  try {
    const emailId = String(req.params.id || "").trim();
    const email = parseEmailPayload(req.body?.email);
    const draft = parseDraftPayload(req.body?.draft);

    if (!emailId || !email || !draft) {
      res.status(400).json({ error: "Payload email/draft invalide" });
      return;
    }

    if (email.id && email.id !== emailId) {
      res.status(400).json({ error: "Incohérence entre email.id et l'URL" });
      return;
    }

    const preparation = await beginDraftSend({ ...email, id: emailId }, draft);

    if (preparation === "already_sent") {
      res.status(409).json({ error: "Ce brouillon est déjà envoyé pour cet email." });
      return;
    }

    if (preparation === "in_progress") {
      res.status(409).json({ error: "Un envoi est déjà en cours pour cet email." });
      return;
    }

    let sendResult: Awaited<ReturnType<typeof sendReplyToMessage>>;
    try {
      sendResult = await sendReplyToMessage({
        originalMessageId: emailId,
        replySubject: draft.sujet,
        replyBody: draft.corps,
      });
    } catch (sendError) {
      try {
        await releaseDraftSendLock(emailId);
      } catch (unlockError) {
        logger.error(`Erreur release lock après échec d'envoi : ${unlockError}`);
      }
      throw sendError;
    }

    try {
      await completeDraftSend(emailId, sendResult.gmailMessageId || null);
    } catch (syncError) {
      logger.error(
        `[SEND] Réponse Gmail envoyée mais synchronisation DB incomplète pour ${emailId}: ${syncError}`
      );

      res.status(202).json({
        success: true,
        emailId,
        gmailMessageId: sendResult.gmailMessageId,
        threadId: sendResult.threadId,
        to: sendResult.to,
        draft: { ...draft, sent: true },
        message: "Réponse envoyée. Statut DB en cours de synchronisation.",
      });
      return;
    }

    res.json({
      success: true,
      emailId,
      gmailMessageId: sendResult.gmailMessageId,
      threadId: sendResult.threadId,
      to: sendResult.to,
      draft: { ...draft, sent: true },
      message: "Réponse envoyée avec succès",
    });
  } catch (error) {
    logger.error(`Erreur send reply : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});


// Route principale — lancer une session complète
app.post("/run", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit ?? req.body?.limit ?? 50);
    const emailLimit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
      : 50;

    logger.info(`[SERVER] Lancement d'une session orchestrateur (limit=${emailLimit})`);
    const emails = await fetchEmails(emailLimit);

    if (emails.length === 0) {
      res.json({ message: "Aucun mail non lu trouvé" });
      return;
    }

    const report = await runOrchestrator(emails);
    res.json(report);

  } catch (error) {
    logger.error(`Erreur run : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});