import { useEffect, useId, useRef, useState } from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
}

export function CustomSelect({ value, options, ariaLabel, onChange }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={open ? "custom-select open" : "custom-select"} ref={rootRef} data-select-target={id}>
      <select
        id={id}
        className="native-select"
        aria-label={ariaLabel}
        tabIndex={-1}
        value={selected?.value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        className="custom-select-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="custom-select-label">{selected?.label ?? ""}</span>
        <span className="custom-select-arrow" aria-hidden="true" />
      </button>

      <div className={open ? "custom-select-menu" : "custom-select-menu hidden"} role="listbox">
        {options.map((option) => (
          <button
            type="button"
            className={option.value === selected?.value ? "custom-option current" : "custom-option"}
            role="option"
            aria-selected={option.value === selected?.value}
            key={option.value}
            onClick={() => selectOption(option.value)}
          >
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
