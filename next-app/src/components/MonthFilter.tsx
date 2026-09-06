import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  months: string[];
  onChange: (value: string) => void;
};

function label(value: string) {
  if (value === 'All') return 'All months';
  return new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });
}

export function MonthFilter({ value, months, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const options = ['All', ...months];

  return (
    <div className="month-filter" ref={rootRef}>
      <button
        className="month-filter-button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label(value)}</span>
        <span className={`month-filter-chevron ${open ? 'open' : ''}`} aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="month-filter-menu" role="listbox" aria-label="Filter transactions by month">
          {options.map((option) => (
            <button
              className={`month-filter-option ${value === option ? 'active' : ''}`}
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{label(option)}</span>
              {value === option ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
