interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "brand" | "amber" | "red" | "blue";
  icon?: string;
}

const toneClasses = {
  brand: "bg-brand-50 text-brand-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-800",
  blue: "bg-blue-50 text-blue-800",
};

export function StatCard({ label, value, tone = "brand", icon }: StatCardProps) {
  return (
    <div className={`rounded-xl p-3 sm:rounded-2xl sm:p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-medium leading-tight opacity-80 sm:text-sm">{label}</span>
        {icon && <span className="shrink-0 text-base sm:text-xl">{icon}</span>}
      </div>
      <p className="mt-1 text-xl font-bold sm:mt-2 sm:text-3xl">{value}</p>
    </div>
  );
}
