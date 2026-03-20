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

export async function analyzeEmail(email: RawEmail): Promise<EmailAnalysis> {
  logger.info(`[READER] Analyse du mail : "${email.subject}"`);
  const client = getAnthropicClient();

  const userMessage = `
Voici l'email à analyser :

De : ${email.from}
Date : ${email.date}
Sujet : ${email.subject}

Corps :
${email.body}
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

    logger.info(`[READER] Analyse terminée — urgence : ${parsed.urgence}`);
    return parsed;

  } catch (error) {
    logger.error(`[READER] Erreur analyse : ${error}`);
    throw new Error(`Impossible d'analyser le mail : ${error}`);
  }
}