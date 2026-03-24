import { useState } from "react";
import { Play, Clock, Mail, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import type { OrchestratorReport } from "../types";
import { runOrchestrator } from "../services/api";
import Badge from "../components/Badge";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";

export default function SessionPage() {
  const [limit, setLimit] = useState(10);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OrchestratorReport | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const data = await runOrchestrator(limit);
      setReport(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur lors de l'execution",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Session Orchestrateur
        </h1>
        <p className="mt-1 text-gray-500">
          Lancez le traitement automatique de vos mails par l'IA
        </p>
      </div>

      {/* Launch panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de mails a traiter
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${running ? "animate-pulse" : ""}`} />
            {running ? "Traitement en cours..." : "Lancer la session"}
          </button>
        </div>
      </div>

      {running && (
        <LoadingSpinner message="L'orchestrateur traite vos mails... Cela peut prendre quelques minutes." />
      )}
      {error && <ErrorAlert message={error} onRetry={handleRun} />}

      {/* Report */}
      {report && !running && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Mail className="w-5 h-5 text-indigo-600" />}
              label="Total mails"
              value={report.total_emails}
            />
            <StatCard
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              label="Traites"
              value={report.emails_traites}
            />
            <StatCard
              icon={<XCircle className="w-5 h-5 text-gray-400" />}
              label="Ignores"
              value={report.emails_ignores}
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-amber-600" />}
              label="Duree totale"
              value={`${(report.performance.duree_totale_ms / 1000).toFixed(1)}s`}
            />
          </div>

          {/* Performance */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Performance</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Traitement</p>
                <p className="font-medium">
                  {(report.performance.duree_traitement_ms / 1000).toFixed(1)}s
                </p>
              </div>
              <div>
                <p className="text-gray-500">Moyenne/mail</p>
                <p className="font-medium">
                  {(report.performance.duree_moyenne_par_mail_ms / 1000).toFixed(
                    1,
                  )}
                  s
                </p>
              </div>
              <div>
                <p className="text-gray-500">Filtres rapides</p>
                <p className="font-medium">
                  {report.performance.emails_filtres_rapides}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Envoyes au redacteur</p>
                <p className="font-medium">
                  {report.performance.emails_envoyes_redacteur}
                </p>
              </div>
            </div>
          </div>

          {/* Session resume */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-2">
              Resume de session
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {report.resume_session}
            </p>
          </div>

          {/* Detailed report */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Rapport detaille
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Sujet
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      De
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Urgence
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Raison
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rapport.map((entry) => (
                    <tr key={entry.email_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {entry.sujet}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                        {entry.from}
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={entry.type} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={entry.urgence} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={entry.action} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {entry.raison}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
