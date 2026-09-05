import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-brand-900">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={[
            "w-full rounded-xl border-2 bg-white px-4 py-3.5 text-base text-brand-900",
            "focus:outline-none focus:ring-4 focus:ring-brand-100",
            error ? "border-red-400 focus:border-red-500" : "border-brand-200 focus:border-brand-500",
            className,
          ].join(" ")}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
