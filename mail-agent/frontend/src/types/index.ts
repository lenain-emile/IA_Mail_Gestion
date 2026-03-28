export interface RawEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

export interface EmailAnalysis {
  intention: string;
  type:
    | "candidature"
    | "relance_candidature"
    | "demande_info"
    | "partenaire"
    | "urgent"
    | "spam"
    | "notification"
    | "autre";
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

export interface EmailDraft {
  sujet: string;
  corps: string;
  ton: "formel" | "bienveillant" | "direct";
  confiance: "haute" | "moyenne" | "faible";
  note: string;
  sent?: boolean;
}

export interface EmailWithAnalysis {
  email: RawEmail;
  analysis: EmailAnalysis;
  draft?: EmailDraft | null;
  message?: string;
}

export interface SavedEmailData {
  analysis: EmailAnalysis | null;
  draft: EmailDraft | null;
}

export interface DraftActionResult {
  success: boolean;
  emailId: string;
  draft: EmailDraft;
  message?: string;
  gmailMessageId?: string;
  threadId?: string | null;
  to?: string;
}

export interface SessionReportEntry {
  email_id: string;
  sujet: string;
  from: string;
  type: string;
  urgence: string;
  action: "reponse_redigee" | "ignore" | "erreur";
  raison: string;
}

export interface SessionPerformance {
  duree_totale_ms: number;
  duree_traitement_ms: number;
  duree_generation_rapport_ms: number;
  duree_moyenne_par_mail_ms: number;
  emails_filtres_rapides: number;
  emails_envoyes_redacteur: number;
  emails_en_erreur: number;
}

export interface OrchestratorReport {
  session_id: string;
  total_emails: number;
  emails_traites: number;
  emails_ignores: number;
  rapport: SessionReportEntry[];
  resume_session: string;
  performance: SessionPerformance;
}
