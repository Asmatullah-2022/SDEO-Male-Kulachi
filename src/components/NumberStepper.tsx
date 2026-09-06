interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

/**
 * Large +/- numeric control for mobile data entry — easier to tap
 * accurately than a bare numeric keyboard on a low-end Android phone, and
 * impossible to enter a non-numeric value.
 */
export function NumberStepper({ label, value, onChange, min = 0, max = 100000 }: NumberStepperProps) {
  function clamp(next: number) {
    return Math.max(min, Math.min(max, next));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-brand-900">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-brand-200 bg-white text-2xl font-bold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits === "" ? 0 : clamp(Number(digits)));
          }}
          className="h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-brand-200 text-center text-lg font-bold text-brand-900 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-brand-200 bg-white text-2xl font-bold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
