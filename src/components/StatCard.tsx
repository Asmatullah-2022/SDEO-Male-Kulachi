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
    <div className={`rounded-2xl p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
