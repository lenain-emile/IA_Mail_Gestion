import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, PenLine } from "lucide-react";
import type { RawEmail, EmailAnalysis, EmailDraft } from "../types";
import {
  fetchEmails,
  analyzeSelectedEmail,
  draftSelectedEmail,
  fetchSavedEmailData,
  saveDraftForEmail,
  sendDraftForEmail,
} from "../services/api";
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
  const [loadingSavedData, setLoadingSavedData] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmails();
      setEmails(data.emails);
      setSelectedId(null);
      setAnalysis(null);
      setDraft(null);
      setActionSuccess(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const currentEmailId = selectedId;

    let isActive = true;

    async function loadSavedDataForSelection() {
      setLoadingSavedData(true);
      setActionError(null);
      setActionSuccess(null);
      setAnalysis(null);
      setDraft(null);

      try {
        const data = await fetchSavedEmailData(currentEmailId);
        if (!isActive) {
          return;
        }
        setAnalysis(data.analysis);
        setDraft(data.draft);
      } catch (e) {
        if (!isActive) {
          return;
        }
        setActionError(
          e instanceof Error
            ? e.message
            : "Erreur lors du chargement des donnees sauvegardees",
        );
      } finally {
        if (isActive) {
          setLoadingSavedData(false);
        }
      }
    }

    loadSavedDataForSelection();

    return () => {
      isActive = false;
    };
  }, [selectedId]);

  const handleAnalyze = async () => {
    if (!selected) {
      setActionError("Selectionnez un mail avant de lancer l'analyse.");
      return;
    }

    setAnalyzing(true);
    setActionError(null);
    setActionSuccess(null);
    setDraft(null);
    try {
      const data = await analyzeSelectedEmail(selected);
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
    if (!selected) {
      setActionError("Selectionnez un mail avant de lancer la redaction.");
      return;
    }

    setDrafting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const data = await draftSelectedEmail(selected);
      setAnalysis(data.analysis);
      setDraft(data.draft ?? null);
      if (data.draft) {
        setActionSuccess("Brouillon genere. Vous pouvez le modifier, sauvegarder puis envoyer.");
      }
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Erreur lors de la redaction",
      );
    } finally {
      setDrafting(false);
    }
  };

  const selected = emails.find((e) => e.id === selectedId);

  const handleDraftChange = (nextDraft: EmailDraft) => {
    setDraft(nextDraft);
    setActionSuccess(null);
  };

  const handleSaveDraft = async () => {
    if (!selected || !draft) {
      setActionError("Aucun brouillon a sauvegarder pour ce mail.");
      return;
    }

    setSavingDraft(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await saveDraftForEmail(selected, draft);
      setDraft(result.draft);
      setActionSuccess(result.message || "Brouillon sauvegarde");
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Erreur lors de la sauvegarde du brouillon",
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendDraft = async () => {
    if (!selected || !draft) {
      setActionError("Aucun brouillon a envoyer pour ce mail.");
      return;
    }

    setSendingDraft(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await sendDraftForEmail(selected, draft);
      setDraft(result.draft);
      setActionSuccess(
        result.message ||
          `Reponse envoyee${result.to ? ` a ${result.to}` : ""}`,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setSendingDraft(false);
    }
  };

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
                  setActionSuccess(null);
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
                    disabled={!selected || analyzing || drafting || savingDraft || sendingDraft}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Sparkles
                      className={`w-4 h-4 ${analyzing ? "animate-pulse" : ""}`}
                    />
                    {analyzing ? "Analyse en cours..." : "Analyser"}
                  </button>
                  <button
                    onClick={handleDraft}
                    disabled={!selected || analyzing || drafting || savingDraft || sendingDraft}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <PenLine
                      className={`w-4 h-4 ${drafting ? "animate-pulse" : ""}`}
                    />
                    {drafting ? "Redaction en cours..." : "Analyser + Rediger"}
                  </button>
                </div>

                {actionError && <ErrorAlert message={actionError} />}
                {actionSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-4 text-sm">
                    {actionSuccess}
                  </div>
                )}
                {loadingSavedData && (
                  <LoadingSpinner message="Chargement des donnees sauvegardees..." />
                )}
                {analyzing && (
                  <LoadingSpinner message="L'IA analyse votre mail..." />
                )}
                {drafting && (
                  <LoadingSpinner message="L'IA redige une reponse..." />
                )}

                {!loadingSavedData && !analyzing && !drafting && !analysis && !draft && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm">
                    Aucune analyse ou brouillon sauvegarde pour ce mail.
                    Lancez une session orchestrateur pour enregistrer automatiquement
                    l'analyse et la reponse en base.
                  </div>
                )}

                {analysis && !analyzing && <AnalysisPanel analysis={analysis} />}
                {draft && !drafting && (
                  <DraftPanel
                    draft={draft}
                    onChange={handleDraftChange}
                    onSave={handleSaveDraft}
                    onSend={handleSendDraft}
                    saving={savingDraft}
                    sending={sendingDraft}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
