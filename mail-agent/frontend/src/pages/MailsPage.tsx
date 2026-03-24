import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, PenLine } from "lucide-react";
import type { RawEmail, EmailAnalysis, EmailDraft } from "../types";
import { fetchEmails, analyzeEmail, draftEmail } from "../services/api";
import EmailCard from "../components/EmailCard";
import AnalysisPanel from "../components/AnalysisPanel";
import DraftPanel from "../components/DraftPanel";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";

export default function MailsPage() {
  const [emails, setEmails] = useState<RawEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmails();
      setEmails(data.emails);
      setSelectedId(null);
      setAnalysis(null);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setActionError(null);
    setDraft(null);
    try {
      const data = await analyzeEmail();
      setAnalysis(data.analysis);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Erreur lors de l'analyse",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDraft = async () => {
    setDrafting(true);
    setActionError(null);
    try {
      const data = await draftEmail();
      setAnalysis(data.analysis);
      setDraft(data.draft ?? null);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Erreur lors de la redaction",
      );
    } finally {
      setDrafting(false);
    }
  };

  const selected = emails.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mails</h1>
          <p className="mt-1 text-gray-500">
            {emails.length} mail{emails.length !== 1 && "s"} non lu
            {emails.length !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={loadEmails}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {loading && <LoadingSpinner message="Chargement des mails..." />}
      {error && <ErrorAlert message={error} onRetry={loadEmails} />}

      {!loading && !error && emails.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Aucun mail non lu</p>
          <p className="text-sm mt-1">
            Tous vos mails ont ete traites ou votre boite est vide.
          </p>
        </div>
      )}

      {!loading && !error && emails.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email list */}
          <div className="space-y-2 lg:col-span-1">
            {emails.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                selected={email.id === selectedId}
                onClick={() => {
                  setSelectedId(email.id);
                  setAnalysis(null);
                  setDraft(null);
                  setActionError(null);
                }}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            {!selected && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
                Selectionnez un mail pour le consulter
              </div>
            )}

            {selected && (
              <>
                {/* Email detail */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selected.subject || "(sans sujet)"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    De : {selected.from} | {selected.date}
                  </p>
                  <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap border-t pt-4">
                    {selected.body}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || drafting}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Sparkles
                      className={`w-4 h-4 ${analyzing ? "animate-pulse" : ""}`}
                    />
                    {analyzing ? "Analyse en cours..." : "Analyser"}
                  </button>
                  <button
                    onClick={handleDraft}
                    disabled={analyzing || drafting}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <PenLine
                      className={`w-4 h-4 ${drafting ? "animate-pulse" : ""}`}
                    />
                    {drafting ? "Redaction en cours..." : "Analyser + Rediger"}
                  </button>
                </div>

                {actionError && <ErrorAlert message={actionError} />}
                {analyzing && (
                  <LoadingSpinner message="L'IA analyse votre mail..." />
                )}
                {drafting && (
                  <LoadingSpinner message="L'IA redige une reponse..." />
                )}

                {analysis && !analyzing && <AnalysisPanel analysis={analysis} />}
                {draft && !drafting && <DraftPanel draft={draft} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
