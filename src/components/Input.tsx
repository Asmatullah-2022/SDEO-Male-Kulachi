import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-brand-900">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "w-full rounded-xl border-2 px-4 py-3.5 text-base text-brand-900",
            "focus:outline-none focus:ring-4 focus:ring-brand-100",
            error ? "border-red-400 focus:border-red-500" : "border-brand-200 focus:border-brand-500",
            props.disabled ? "bg-gray-100 text-gray-500" : "bg-white",
            className,
          ].join(" ")}
          {...props}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
