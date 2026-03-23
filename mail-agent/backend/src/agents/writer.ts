import Anthropic from "@anthropic-ai/sdk";
import { WRITER_SYSTEM_PROMPT } from "../prompts/writer";
import { EmailAnalysis, RawEmail } from "./reader";
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

// Type de retour de l'agent rédacteur
export interface EmailDraft {
  sujet: string;
  corps: string;
  ton: "formel" | "bienveillant" | "direct";
  confiance: "haute" | "moyenne" | "faible";
  note: string;
}

export async function writeReply(
  email: RawEmail,
  analysis: EmailAnalysis
): Promise<EmailDraft> {
  logger.info(`[WRITER] Rédaction réponse pour : "${email.subject}"`);
  const client = getAnthropicClient();

  const userMessage = `
De : ${email.from}
Sujet : ${email.subject}
Type : ${analysis.type}
Urgence : ${analysis.urgence}
Intention : ${analysis.intention}
Résumé : ${analysis.resume}
Personnes : ${analysis.entites.personnes.join(", ") || "aucune"}
  `.trim();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: WRITER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed: EmailDraft = JSON.parse(clean);

    logger.info(`[WRITER] Brouillon rédigé — confiance : ${parsed.confiance}`);
    return parsed;

  } catch (error) {
    logger.error(`[WRITER] Erreur rédaction : ${error}`);
    throw new Error(`Impossible de rédiger la réponse : ${error}`);
  }
}
