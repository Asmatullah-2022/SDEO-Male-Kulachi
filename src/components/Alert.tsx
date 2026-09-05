interface AlertProps {
  type?: "success" | "error" | "info" | "warning";
  children: React.ReactNode;
}

const styles = {
  success: "bg-brand-50 text-brand-800 border-brand-200",
  error: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
};

const icons = {
  success: "✅",
  error: "⚠️",
  info: "ℹ️",
  warning: "⚠️",
};

export function Alert({ type = "info", children }: AlertProps) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}
