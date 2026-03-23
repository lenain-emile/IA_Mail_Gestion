import Anthropic from "@anthropic-ai/sdk";
import { READER_SYSTEM_PROMPT } from "../prompts/reader";
import logger from "../utils/logger";

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Ajoute-la dans backend/.env puis redemarre le serveur."
    );
  }

  return new Anthropic({ apiKey });
}

export interface EmailAnalysis {
  intention: string;
  type: "candidature" | "relance_candidature" | "demande_info" | "partenaire" | "urgent" | "spam" | "notification" | "autre";
  urgence: "urgent" | "normal" | "faible";
  source_analyse?: "filtre_rapide" | "ia";
  transmettre_au_redacteur: boolean;
  raison_transmission: string;
  resume: string;
  entites: {
    personnes: string[];
    dates: string[];
    montants: string[];
    liens: string[];
  };
}

// Type d'un mail brut
export interface RawEmail {
  id: string | null | undefined;
  subject: string;
  from: string;
  date: string;
  body: string;
}

function quickRejectIfUninteresting(email: RawEmail): EmailAnalysis | null {
  const subject = (email.subject || "").toLowerCase();
  const from = (email.from || "").toLowerCase();
  const bodyPreview = (email.body || "").slice(0, 600).toLowerCase();

  if (!email.body || email.body.trim().length < 10) {
    return {
      intention: "Email vide ou illisible",
      type: "notification",
      urgence: "faible",
      source_analyse: "filtre_rapide",
      transmettre_au_redacteur: false,
      raison_transmission: "Corps du mail vide ou trop court",
      resume: "Email sans contenu exploitable.",
      entites: {
        personnes: [],
        dates: [],
        montants: [],
        liens: [],
      },
    };
  }

  const spamOrPromoSignals = [
    "unsubscribe",
    "se desabonner",
    "se désabonner",
    "newsletter",
    "promotion",
    "promo",
    "offre limitee",
    "offre speciale",
    "offre spéciale",
    "soldes",
    "black friday",
    "code promo",
    "livraison gratuite",
    "cliquez ici",
    "achetez maintenant",
    "publicite",
    "gagnez",
    "casino",
    "bitcoin",
  ];

  const technicalNotificationSignals = [
    "no-reply",
    "noreply",
    "do-not-reply",
    "mailer-daemon",
    "delivery status notification",
    "undelivered",
    "mot de passe",
    "password reset",
    "verification",
    "github",
    "gitlab",
    "trello",
    "jira",
    "slack",
    "vercel",
    "railway",
  ];

  const hasSpamSignal = spamOrPromoSignals.some(
    (signal) =>
      subject.includes(signal) || from.includes(signal) || bodyPreview.includes(signal)
  );

  if (hasSpamSignal) {
    return {
      intention: "Message promotionnel ou spam detecte par filtre rapide",
      type: "spam",
      urgence: "faible",
      source_analyse: "filtre_rapide",
      transmettre_au_redacteur: false,
      raison_transmission: "Mail non pertinent (spam/publicite)",
      resume: "Mail filtre automatiquement avant appel IA.",
      entites: {
        personnes: [],
        dates: [],
        montants: [],
        liens: [],
      },
    };
  }

  const hasTechnicalSignal = technicalNotificationSignals.some(
    (signal) =>
      subject.includes(signal) || from.includes(signal) || bodyPreview.includes(signal)
  );

  if (hasTechnicalSignal) {
    return {
      intention: "Notification technique detectee par filtre rapide",
      type: "notification",
      urgence: "faible",
      source_analyse: "filtre_rapide",
      transmettre_au_redacteur: false,
      raison_transmission: "Notification automatique non redigeable",
      resume: "Notification systeme filtree avant appel IA.",
      entites: {
        personnes: [],
        dates: [],
        montants: [],
        liens: [],
      },
    };
  }

  return null;
}

export async function analyzeEmail(email: RawEmail): Promise<EmailAnalysis> {
  logger.info(`[READER] Analyse du mail : "${email.subject}"`);
  const quickRejected = quickRejectIfUninteresting(email);
  if (quickRejected) {
    logger.info(`[READER] Mail filtre sans IA — type : ${quickRejected.type}`);
    return quickRejected;
  }

  const client = getAnthropicClient();

  const userMessage = `
Voici l'email à analyser :

De : ${email.from}
Date : ${email.date}
Sujet : ${email.subject}

Corps :
${email.body.slice(0, 1500)}
  `.trim();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: READER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extraire le texte de la réponse
    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Nettoyer et parser le JSON
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed: EmailAnalysis = JSON.parse(clean);
    parsed.source_analyse = "ia";

    logger.info(`[READER] Analyse terminée — urgence : ${parsed.urgence}`);
    return parsed;

  } catch (error) {
    logger.error(`[READER] Erreur analyse : ${error}`);
    throw new Error(`Impossible d'analyser le mail : ${error}`);
  }
}