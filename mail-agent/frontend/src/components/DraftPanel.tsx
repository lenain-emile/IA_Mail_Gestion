import { PenLine, Copy, Check, Save, Send } from "lucide-react";
import { useState } from "react";
import Badge from "./Badge";
import type { EmailDraft } from "../types";

type DraftPanelProps = {
  draft: EmailDraft;
  onChange: (nextDraft: EmailDraft) => void;
  onSave: () => void;
  onSend: () => void;
  saving: boolean;
  sending: boolean;
};

export default function DraftPanel({
  draft,
  onChange,
  onSave,
  onSend,
  saving,
  sending,
}: DraftPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft.corps);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canSave = draft.sujet.trim().length > 0 && draft.corps.trim().length > 0;
  const isSent = Boolean(draft.sent);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-700">
          <PenLine className="w-5 h-5" />
          <h3 className="font-semibold">Brouillon de reponse</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={draft.ton} />
          <Badge value={draft.confiance} />
          {isSent && <Badge value="envoye" />}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Sujet</p>
        <input
          value={draft.sujet}
          onChange={(e) => onChange({ ...draft, sujet: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          placeholder="Sujet de la reponse"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">Corps</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" /> Copie !
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copier
              </>
            )}
          </button>
        </div>
        <textarea
          value={draft.corps}
          onChange={(e) => onChange({ ...draft, corps: e.target.value })}
          rows={10}
          className="w-full bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          placeholder="Corps de la reponse"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Ton</p>
          <select
            value={draft.ton}
            onChange={(e) =>
              onChange({
                ...draft,
                ton: e.target.value as EmailDraft["ton"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="formel">formel</option>
            <option value="bienveillant">bienveillant</option>
            <option value="direct">direct</option>
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Confiance</p>
          <select
            value={draft.confiance}
            onChange={(e) =>
              onChange({
                ...draft,
                confiance: e.target.value as EmailDraft["confiance"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="haute">haute</option>
            <option value="moyenne">moyenne</option>
            <option value="faible">faible</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Note IA / interne</p>
        <textarea
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          placeholder="Notes complementaires"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!canSave || saving || sending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        <button
          onClick={onSend}
          disabled={!canSave || saving || sending || isSent}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isSent ? "Deja envoye" : sending ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
