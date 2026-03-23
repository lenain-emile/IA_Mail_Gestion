import "dotenv/config";
import { Pool } from "pg";
import logger from "../utils/logger";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquante. Ajoute-la dans backend/.env puis redemarre le serveur.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  logger.info("[DB] Connexion PostgreSQL établie");
});

pool.on("error", (error) => {
  logger.error(`[DB] Erreur PostgreSQL : ${error}`);
});

export default pool;
