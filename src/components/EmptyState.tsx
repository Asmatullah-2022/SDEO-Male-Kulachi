interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-6 py-10 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-base font-semibold text-brand-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-600">{description}</p>}
      {action}
    </div>
  );
}
