import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ message = "Chargement..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
