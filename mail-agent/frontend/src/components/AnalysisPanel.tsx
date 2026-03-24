import {
  Brain,
  Tag,
  AlertCircle,
  FileText,
  Users,
  CalendarDays,
  DollarSign,
  Link,
} from "lucide-react";
import Badge from "./Badge";
import type { EmailAnalysis } from "../types";

export default function AnalysisPanel({
  analysis,
}: {
  analysis: EmailAnalysis;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2 text-indigo-700">
        <Brain className="w-5 h-5" />
        <h3 className="font-semibold">Analyse IA</h3>
        {analysis.source_analyse && (
          <Badge value={analysis.source_analyse} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Type
          </p>
          <Badge value={analysis.type} />
        </div>
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Urgence
          </p>
          <Badge value={analysis.urgence} />
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
          <FileText className="w-3 h-3" /> Intention
        </p>
        <p className="text-sm text-gray-700">{analysis.intention}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Resume</p>
        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
          {analysis.resume}
        </p>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Transmission</p>
        <p className="text-sm text-gray-700">
          {analysis.transmettre_au_redacteur ? (
            <span className="text-green-600 font-medium">
              Oui - {analysis.raison_transmission}
            </span>
          ) : (
            <span className="text-gray-500">
              Non - {analysis.raison_transmission}
            </span>
          )}
        </p>
      </div>

      {(analysis.entites.personnes.length > 0 ||
        analysis.entites.dates.length > 0 ||
        analysis.entites.montants.length > 0 ||
        analysis.entites.liens.length > 0) && (
        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 mb-2">Entites extraites</p>
          <div className="space-y-1.5 text-sm">
            {analysis.entites.personnes.length > 0 && (
              <p className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                {analysis.entites.personnes.join(", ")}
              </p>
            )}
            {analysis.entites.dates.length > 0 && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                {analysis.entites.dates.join(", ")}
              </p>
            )}
            {analysis.entites.montants.length > 0 && (
              <p className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                {analysis.entites.montants.join(", ")}
              </p>
            )}
            {analysis.entites.liens.length > 0 && (
              <p className="flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-gray-400" />
                {analysis.entites.liens.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
