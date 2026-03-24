import { PenLine, Copy, Check } from "lucide-react";
import { useState } from "react";
import Badge from "./Badge";
import type { EmailDraft } from "../types";

export default function DraftPanel({ draft }: { draft: EmailDraft }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft.corps);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Sujet</p>
        <p className="text-sm font-medium text-gray-900">{draft.sujet}</p>
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
        <div className="bg-gray-50 p-4 rounded text-sm text-gray-700 whitespace-pre-wrap">
          {draft.corps}
        </div>
      </div>

      {draft.note && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Note IA</p>
          <p className="text-sm text-gray-600 italic">{draft.note}</p>
        </div>
      )}
    </div>
  );
}
