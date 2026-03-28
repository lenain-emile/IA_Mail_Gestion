import { google } from "googleapis";
import fs from "fs";
import path from "path";
import logger from "../utils/logger";

// Chemins des fichiers
function resolveCredentialsPath(): string {
  const fromEnv = process.env.GOOGLE_CREDENTIALS_PATH;
  if (fromEnv) {
    const absolute = path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);

    if (!fs.existsSync(absolute)) {
      throw new Error(
        `Fichier credentials introuvable via GOOGLE_CREDENTIALS_PATH: ${absolute}`
      );
    }

    return absolute;
  }

  const defaultPath = path.join(process.cwd(), "credentials.json");
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  const files = fs.readdirSync(process.cwd());
  const secretFile = files.find(
    (name) =>
      name.startsWith("client_secret_") &&
      name.endsWith(".json")
  );

  if (secretFile) {
    return path.join(process.cwd(), secretFile);
  }

  throw new Error(
    "Aucun fichier credentials Google trouvé. Ajoutez credentials.json ou définissez GOOGLE_CREDENTIALS_PATH."
  );
}

const TOKEN_PATH = path.join(process.cwd(), "token.json");

// Scopes — ce que l'agent a le droit de faire
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",  // lire les mails
  "https://www.googleapis.com/auth/gmail.send",       // envoyer des mails
  "https://www.googleapis.com/auth/gmail.modify",     // modifier (tags, lu/non lu)
];

// Créer le client OAuth2
export function createOAuthClient() {
  const credentialsPath = resolveCredentialsPath();
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.web;

  if (!client_id || !client_secret || !redirect_uris?.[0]) {
    throw new Error(
      "Format invalide du fichier credentials Google (client_id/client_secret/redirect_uris manquants)."
    );
  }

  return new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
}

// Générer l'URL de connexion Google
export function getAuthUrl(): string {
  const oAuth2Client = createOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  logger.info("URL d'authentification générée");
  return url;
}

// Échanger le code contre un token et le sauvegarder
export async function saveToken(code: string): Promise<void> {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  logger.info("Token sauvegardé avec succès");
}

// Récupérer un client authentifié
export function getAuthenticatedClient() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error("Token introuvable — connectez-vous d'abord via /auth/login");
  }

  const oAuth2Client = createOAuthClient();
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

// Récupérer les derniers mails
export async function fetchEmails(maxResults: number = 10) {
  const auth = getAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth });

  // Récupérer la liste des IDs
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "is:unread", // uniquement les non lus
  });

  const messages = list.data.messages || [];
  logger.info(`${messages.length} mails récupérés`);

  // Récupérer le détail de chaque mail
  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "Sans sujet";
      const from = headers.find((h) => h.name === "From")?.value || "Inconnu";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      // Extraire le corps du mail
      const body = extractBody(detail.data.payload);

      return {
        id: msg.id,
        subject,
        from,
        date,
        body: body.slice(0, 2000),
      };
    })
  );

  return emails;
}

function getHeaderValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  headerName: string
): string {
  if (!headers) {
    return "";
  }

  const found = headers.find(
    (h) => (h.name || "").toLowerCase() === headerName.toLowerCase()
  );

  return found?.value || "";
}

function extractEmailAddress(fromHeader: string): string {
  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim();
  }

  const rawMatch = fromHeader.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (rawMatch?.[0]) {
    return rawMatch[0].trim();
  }

  throw new Error(`Impossible d'extraire une adresse email depuis: ${fromHeader}`);
}

function normalizeReplySubject(subject: string): string {
  const clean = (subject || "").trim() || "(sans sujet)";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendReplyToMessage(params: {
  originalMessageId: string;
  replySubject: string;
  replyBody: string;
}): Promise<{ gmailMessageId: string; threadId: string | null; to: string }> {
  const auth = getAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const original = await gmail.users.messages.get({
    userId: "me",
    id: params.originalMessageId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Message-ID", "References"],
  });

  const headers = original.data.payload?.headers;
  const fromHeader = getHeaderValue(headers, "From");
  const subjectHeader = getHeaderValue(headers, "Subject");
  const messageIdHeader = getHeaderValue(headers, "Message-ID");
  const referencesHeader = getHeaderValue(headers, "References");

  const to = extractEmailAddress(fromHeader);
  const subject = normalizeReplySubject(params.replySubject || subjectHeader);
  const references = [referencesHeader, messageIdHeader].filter(Boolean).join(" ").trim();
  const body = (params.replyBody || "").replace(/\r?\n/g, "\r\n");

  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];

  if (messageIdHeader) {
    lines.push(`In-Reply-To: ${messageIdHeader}`);
  }

  if (references) {
    lines.push(`References: ${references}`);
  }

  const mimeMessage = [...lines, "", body].join("\r\n");

  const sendResponse = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: toBase64Url(mimeMessage),
      threadId: original.data.threadId || undefined,
    },
  });

  logger.info(`[GMAIL] Réponse envoyée pour message ${params.originalMessageId}`);

  return {
    gmailMessageId: sendResponse.data.id || "",
    threadId: sendResponse.data.threadId || original.data.threadId || null,
    to,
  };
}

// Extraire le texte du corps du mail
function extractBody(payload: any): string {
  if (!payload) return "";

  // Mail simple
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Mail avec plusieurs parties
  if (payload.parts) {
    const textPart = payload.parts.find(
      (p: any) => p.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }
  }

  return "";
}