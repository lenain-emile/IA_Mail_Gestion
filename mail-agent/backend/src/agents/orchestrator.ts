import Anthropic from "@anthropic-ai/sdk";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "../prompts/orchestrator";
import { emailAlreadyProcessed, saveEmailResult, saveSession } from "../db/emails";
import { analyzeEmail, RawEmail } from "./reader";
import { writeReply, EmailDraft } from "./writer";
import logger from "../utils/logger";

function getErrorDetails(error: unknown): string {
  const maybeAggregate = error as {
    name?: string;
    message?: string;
    errors?: unknown[];
  };

  if (maybeAggregate?.name === "AggregateError" && Array.isArray(maybeAggregate.errors)) {
    const details = maybeAggregate.errors
      .map((e: unknown, index: number) => `#${index + 1}: ${e instanceof Error ? e.message : String(e)}`)
      .join(" | ");
    const baseMessage = maybeAggregate.message || "AggregateError";
    return details ? `${baseMessage} (${details})` : baseMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Ajoute-la dans backend/.env puis redemarre le serveur."
    );
  }

  return new Anthropic({ apiKey });
}

// Types
export interface EmailResult {
  email: RawEmail;
  analysis: Awaited<ReturnType<typeof analyzeEmail>>;
  draft: EmailDraft | null;
  action: "réponse_rédigée" | "ignoré" | "erreur";
  raison: string;
}

export interface OrchestratorReport {
  session_id: string;
  total_emails: number;
  emails_traites: number;
  emails_ignores: number;
  rapport: {
    email_id: string;
    sujet: string;
    from: string;
    type: string;
    urgence: string;
    action: string;
    raison: string;
  }[];
  resume_session: string;
  resultats: EmailResult[];
  performance: {
    duree_totale_ms: number;
    duree_traitement_ms: number;
    duree_generation_rapport_ms: number;
    duree_moyenne_par_mail_ms: number;
    emails_filtres_rapides: number;
    emails_envoyes_redacteur: number;
    emails_en_erreur: number;
  };
}

function buildLocalReport(resultats: EmailResult[]): Omit<OrchestratorReport, "resultats" | "performance"> {
  const rapport = resultats.map((r) => ({
    email_id: String(r.email.id || "inconnu"),
    sujet: r.email.subject,
    from: r.email.from,
    type: r.analysis?.type || "erreur",
    urgence: r.analysis?.urgence || "inconnue",
    action: r.action,
    raison: r.raison,
  }));

  const emailsTraites = resultats.filter((r) => r.action === "réponse_rédigée").length;
  const emailsIgnores = resultats.filter((r) => r.action === "ignoré").length;
  const emailsErreurs = resultats.filter((r) => r.action === "erreur").length;

  const resumeSession =
    `Session locale: ${resultats.length} email(s), ` +
    `${emailsTraites} traité(s), ${emailsIgnores} ignoré(s), ${emailsErreurs} erreur(s).`;

  return {
    session_id: new Date().toISOString(),
    total_emails: resultats.length,
    emails_traites: emailsTraites,
    emails_ignores: emailsIgnores,
    rapport,
    resume_session: resumeSession,
  };
}

// Trier les emails par priorité
function prioritizeEmails(emails: RawEmail[]): RawEmail[] {
  // On fait une première passe rapide pour détecter les types
  // Le tri réel se fait après l'analyse complète
  logger.info(`[ORCHESTRATOR] Priorisation de ${emails.length} emails`);
  return emails.slice(0, 50); // max 50 par session
}

// Traiter un seul email (lecture + rédaction si nécessaire)
async function processEmail(email: RawEmail): Promise<EmailResult> {
  try {
    if (email.id) {
      const alreadyDone = await emailAlreadyProcessed(email.id);
      if (alreadyDone) {
        logger.info(`[ORCHESTRATOR] Déjà traité : ${email.id}`);
        return {
          email,
          analysis: null as any,
          draft: null,
          action: "ignoré",
          raison: "Déjà traité lors d'une session précédente",
        };
      }
    } else {
      logger.warn("[ORCHESTRATOR] Email sans id, vérification anti-doublon ignorée");
    }

    // Étape 1 — Agent Lecteur
    const analysis = await analyzeEmail(email);

    // Étape 2 — Agent Rédacteur (seulement si nécessaire)
    const draft = analysis.transmettre_au_redacteur
      ? await writeReply(email, analysis)
      : null;

    // Étape 3 — Sauvegarde en transaction
    if (email.id) {
      await saveEmailResult(email, analysis, draft);
    } else {
      logger.warn("[ORCHESTRATOR] Email sans id, sauvegarde DB ignorée");
    }

    return {
      email,
      analysis,
      draft,
      action: draft ? "réponse_rédigée" : "ignoré",
      raison: analysis.raison_transmission,
    };

  } catch (error) {
    logger.error(`[ORCHESTRATOR] Erreur traitement mail ${email.id} : ${getErrorDetails(error)}`);
    return {
      email,
      analysis: null as any,
      draft: null,
      action: "erreur",
      raison: getErrorDetails(error),
    };
  }
}

// Générer le rapport final via Claude
async function generateReport(
  resultats: EmailResult[]
): Promise<OrchestratorReport> {
  logger.info("[ORCHESTRATOR] Génération du rapport final");
  const client = getAnthropicClient();

  const summary = resultats.map((r) => ({
    email_id: r.email.id,
    sujet: r.email.subject,
    from: r.email.from,
    type: r.analysis?.type || "erreur",
    urgence: r.analysis?.urgence || "inconnue",
    action: r.action,
    raison: r.raison,
  }));

  const userMessage = `
Voici les résultats du traitement de ${resultats.length} emails :
${JSON.stringify(summary, null, 2)}

Génère le rapport final de session.
  `.trim();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    const report = JSON.parse(clean);
    return { ...report, resultats };
  } catch (parseError) {
    logger.error(
      `[ORCHESTRATOR] Rapport Claude invalide, fallback local activé: ${getErrorDetails(parseError)}`
    );
    const fallback = buildLocalReport(resultats);
    return { ...fallback, resultats } as OrchestratorReport;
  }
}

// Fonction principale — point d'entrée de l'orchestrateur
export async function runOrchestrator(
  emails: RawEmail[]
): Promise<OrchestratorReport> {
  const sessionStart = Date.now();
  logger.info(`[ORCHESTRATOR] Démarrage session — ${emails.length} emails reçus`);

  // Étape 1 — Prioriser
  const prioritized = prioritizeEmails(emails);

  // Étape 2 — Traiter chaque email séquentiellement
  const resultats: EmailResult[] = [];
  const processingStart = Date.now();
  for (const email of prioritized) {
    logger.info(`[ORCHESTRATOR] Traitement : "${email.subject}"`);
    const result = await processEmail(email);
    resultats.push(result);
  }
  const processingDurationMs = Date.now() - processingStart;

  const emailsFiltresRapides = resultats.filter(
    (r) => r.analysis?.source_analyse === "filtre_rapide"
  ).length;
  const emailsEnvoyesRedacteur = resultats.filter(
    (r) => r.action === "réponse_rédigée"
  ).length;
  const emailsEnErreur = resultats.filter((r) => r.action === "erreur").length;
  const avgEmailMs = resultats.length > 0
    ? Math.round(processingDurationMs / resultats.length)
    : 0;

  // Étape 3 — Générer le rapport
  const reportStart = Date.now();
  const report = await generateReport(resultats);
  const reportDurationMs = Date.now() - reportStart;
  const totalDurationMs = Date.now() - sessionStart;

  logger.info(
    `[ORCHESTRATOR] Perf — total=${totalDurationMs}ms, traitement=${processingDurationMs}ms, rapport=${reportDurationMs}ms, avg/mail=${avgEmailMs}ms, filtres_rapides=${emailsFiltresRapides}, redaction=${emailsEnvoyesRedacteur}, erreurs=${emailsEnErreur}`
  );

  logger.info(`[ORCHESTRATOR] Session terminée — ${report.emails_traites} traités / ${report.emails_ignores} ignorés`);
  const finalReport: OrchestratorReport = {
    ...report,
    performance: {
      duree_totale_ms: totalDurationMs,
      duree_traitement_ms: processingDurationMs,
      duree_generation_rapport_ms: reportDurationMs,
      duree_moyenne_par_mail_ms: avgEmailMs,
      emails_filtres_rapides: emailsFiltresRapides,
      emails_envoyes_redacteur: emailsEnvoyesRedacteur,
      emails_en_erreur: emailsEnErreur,
    },
  };

  await saveSession(finalReport);
  return finalReport;
}
