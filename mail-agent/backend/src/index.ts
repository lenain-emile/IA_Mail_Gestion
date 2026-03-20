import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./utils/logger";
import { analyzeEmail } from "./agents/reader";
import { writeReply } from "./agents/writer";
import { getAuthUrl, saveToken, fetchEmails } from "./tools/gmail";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// Test — Analyser le premier mail
app.get("/mails/analyze", async (req, res) => {
  try {
    const emails = await fetchEmails(1);

    if (emails.length === 0) {
      res.json({ message: "Aucun mail non lu trouvé" });
      return;
    }

    const analysis = await analyzeEmail(emails[0]);
    res.json({ email: emails[0], analysis });
  } catch (error) {
    logger.error(`Erreur analyze : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  logger.info(`Serveur démarré sur le port ${PORT}`);
});

// Test — Lire + Rédiger pour le premier mail
app.get("/mails/draft", async (req, res) => {
  try {
    const emails = await fetchEmails(50);

    if (emails.length === 0) {
      res.json({ message: "Aucun mail non lu trouvé" });
      return;
    }

    const analysis = await analyzeEmail(emails[0]);

    // Le rédacteur n'intervient que si le lecteur le décide
    if (!analysis.transmettre_au_redacteur) {
      res.json({
        email: emails[0],
        analysis,
        draft: null,
        message: `Mail ignoré — ${analysis.raison_transmission}`,
      });
      return;
    }

    const draft = await writeReply(emails[0], analysis);
    res.json({ email: emails[0], analysis, draft });

  } catch (error) {
    logger.error(`Erreur draft : ${error}`);
    res.status(500).json({ error: String(error) });
  }
});