"use client";

type Props = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function SwitchControl({ checked, label, onChange, disabled = false, compact = false }: Props) {
  return (
    <label className={`switch-control ${compact ? "compact" : ""}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="switch-track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}
