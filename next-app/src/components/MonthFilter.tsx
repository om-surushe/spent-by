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
  const options = ['All', ...months];

  return (
    <div className="month-filter">
      <span className="month-filter-label">Filter</span>
      <div className="month-filter-rail" role="listbox" aria-label="Filter transactions by month">
        {options.map((option) => (
          <button
            className={`month-filter-chip ${value === option ? 'active' : ''}`}
            key={option}
            type="button"
            role="option"
            aria-selected={value === option}
            onClick={() => onChange(option)}
          >
            {label(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
