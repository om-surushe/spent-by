export type HomeSectionId = 'quick-add' | 'transactions' | 'monthly-budget' | 'review' | 'overview';

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  'quick-add': 'Quick Add',
  transactions: 'Recent Transactions',
  'monthly-budget': 'Monthly Budget',
  review: 'Needs Review',
  overview: 'Overview'
};

export const HOME_PRESETS: Record<string, HomeSectionId[]> = {
  'Quick Add': ['quick-add', 'transactions', 'overview', 'monthly-budget', 'review'],
  'Quick Check': ['transactions', 'overview', 'monthly-budget', 'quick-add', 'review'],
  'Budget Check': ['monthly-budget', 'overview', 'transactions', 'quick-add', 'review'],
  'Review Mode': ['review', 'transactions', 'quick-add', 'overview', 'monthly-budget'],
  Minimal: ['quick-add', 'transactions', 'overview', 'monthly-budget', 'review']
};

type Props = {
  order: HomeSectionId[];
  hidden: HomeSectionId[];
  onOrderChange: (next: HomeSectionId[]) => void;
  onHiddenChange: (next: HomeSectionId[]) => void;
};

export function HomeCustomizer({ order, hidden, onOrderChange, onHiddenChange }: Props) {
  function move(id: HomeSectionId, direction: -1 | 1) {
    const index = order.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onOrderChange(next);
  }

  function reorder(dragged: HomeSectionId, target: HomeSectionId) {
    if (dragged === target) return;
    const next = order.filter((item) => item !== dragged);
    const targetIndex = next.indexOf(target);
    next.splice(targetIndex, 0, dragged);
    onOrderChange(next);
  }

  function toggleSection(id: HomeSectionId) {
    onHiddenChange(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id]);
  }

  return (
    <details className="card home-customizer full-span">
      <summary>
        <span>
          <span className="eyebrow">Home</span>
          <strong>Customize layout</strong>
        </span>
        <span className="customize-hint">Presets, visibility, order</span>
      </summary>

      <div className="customizer-body">
        <div>
          <p className="customizer-label">Presets</p>
          <div className="preset-strip">
            {Object.entries(HOME_PRESETS).map(([name, preset]) => (
              <button
                className="button"
                key={name}
                type="button"
                onClick={() => {
                  onOrderChange(preset);
                  onHiddenChange(name === 'Minimal' ? ['monthly-budget', 'review'] : []);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="customizer-label">Sections</p>
          <div className="section-order-list">
            {order.map((id, index) => (
              <div
                className="section-order-row"
                draggable
                key={id}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const dragged = event.dataTransfer.getData('text/plain') as HomeSectionId;
                  if (order.includes(dragged)) reorder(dragged, id);
                }}
              >
                <span className="drag-handle" aria-hidden="true">☰</span>
                <span className="section-order-name">{HOME_SECTION_LABELS[id]}</span>
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={!hidden.includes(id)}
                    onChange={() => toggleSection(id)}
                  />
                  Show
                </label>
                <div className="reorder-fallback">
                  <button className="icon-button" type="button" disabled={index === 0} onClick={() => move(id, -1)} aria-label={`Move ${HOME_SECTION_LABELS[id]} up`}>↑</button>
                  <button className="icon-button" type="button" disabled={index === order.length - 1} onClick={() => move(id, 1)} aria-label={`Move ${HOME_SECTION_LABELS[id]} down`}>↓</button>
                </div>
              </div>
            ))}
          </div>
          <p className="customizer-help">Drag on desktop. Use the arrows on touch devices.</p>
        </div>
      </div>
    </details>
  );
}
