import type { ReactNode } from "react";

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-destructive">⚠ {error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className="segmented-item"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
