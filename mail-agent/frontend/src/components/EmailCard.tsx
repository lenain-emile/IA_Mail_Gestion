import { User, Calendar } from "lucide-react";
import type { RawEmail } from "../types";

export default function EmailCard({
  email,
  selected,
  onClick,
}: {
  email: RawEmail;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        selected
          ? "border-indigo-300 bg-indigo-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <h3 className="font-medium text-gray-900 truncate">
        {email.subject || "(sans sujet)"}
      </h3>
      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {email.from}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {email.date}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{email.body}</p>
    </button>
  );
}
