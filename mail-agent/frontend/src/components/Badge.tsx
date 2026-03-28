const colors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  normal: "bg-blue-100 text-blue-700",
  faible: "bg-gray-100 text-gray-600",
  candidature: "bg-purple-100 text-purple-700",
  relance_candidature: "bg-violet-100 text-violet-700",
  demande_info: "bg-sky-100 text-sky-700",
  partenaire: "bg-emerald-100 text-emerald-700",
  spam: "bg-orange-100 text-orange-700",
  notification: "bg-yellow-100 text-yellow-700",
  autre: "bg-gray-100 text-gray-600",
  haute: "bg-green-100 text-green-700",
  moyenne: "bg-yellow-100 text-yellow-700",
  formel: "bg-slate-100 text-slate-700",
  bienveillant: "bg-pink-100 text-pink-700",
  direct: "bg-amber-100 text-amber-700",
  reponse_redigee: "bg-green-100 text-green-700",
  envoye: "bg-emerald-100 text-emerald-700",
  ignore: "bg-gray-100 text-gray-600",
  erreur: "bg-red-100 text-red-700",
};

export default function Badge({ value }: { value: string }) {
  const color = colors[value] || "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
