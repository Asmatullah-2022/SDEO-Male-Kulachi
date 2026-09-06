import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const textareaId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-semibold text-brand-900">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={3}
          className={[
            "w-full resize-none rounded-xl border-2 px-4 py-3.5 text-base text-brand-900",
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
Textarea.displayName = "Textarea";
