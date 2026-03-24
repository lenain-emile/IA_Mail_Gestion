import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Mail,
  Play,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { checkHealth } from "../services/api";

export default function DashboardPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const check = () => {
    setStatus("loading");
    checkHealth()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">
          Vue d'ensemble de votre assistant mail IA
        </p>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Statut du serveur</h2>
        </div>

        {status === "loading" && (
          <LoadingSpinner message="Verification du serveur..." />
        )}
        {status === "ok" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">
              Backend connecte et fonctionnel
            </span>
          </div>
        )}
        {status === "error" && (
          <ErrorAlert
            message="Le serveur backend est inaccessible. Verifiez qu'il est lance sur le port 3000."
            onRetry={check}
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/mails"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Voir les mails</h3>
          </div>
          <p className="text-sm text-gray-500">
            Consultez vos mails non lus, analysez-les individuellement avec l'IA
          </p>
        </Link>

        <Link
          to="/session"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:border-emerald-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <Play className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900">
              Lancer une session
            </h3>
          </div>
          <p className="text-sm text-gray-500">
            Traitez automatiquement tous vos mails avec l'orchestrateur IA
          </p>
        </Link>
      </div>

      {/* Auth reminder */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Connexion Gmail requise
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Avant d'utiliser les fonctionnalites mail, connectez-vous via
              Google OAuth en cliquant sur{" "}
              <strong>"Connexion Gmail"</strong> dans la barre de navigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
