import { AlertTriangle } from "lucide-react";

export default function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Rssayer
          </button>
        )}
      </div>
    </div>
  );
}
