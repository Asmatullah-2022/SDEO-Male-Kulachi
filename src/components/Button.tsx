import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200",
  secondary:
    "bg-brand-50 text-brand-800 border border-brand-200 hover:bg-brand-100 disabled:opacity-50",
  outline:
    "bg-white text-brand-700 border-2 border-brand-600 hover:bg-brand-50 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-200",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50 disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", fullWidth, loading, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold",
          "transition-colors disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
          fullWidth ? "w-full" : "",
          variantClasses[variant],
          className,
        ].join(" ")}
        {...props}
      >
        {loading && (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
