import { useState } from 'react';

type Props = {
  sources: string[];
  categories: string[];
  subcategories: Record<string, string[]>;
  defaultSource: string;
  onSourcesChange: (next: string[]) => void;
  onCategoriesChange: (next: string[]) => void;
  onSubcategoriesChange: (next: Record<string, string[]>) => void;
  onDefaultSourceChange: (next: string) => void;
};

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function FinanceLabelsSettings({
  sources,
  categories,
  subcategories,
  defaultSource,
  onSourcesChange,
  onCategoriesChange,
  onSubcategoriesChange,
  onDefaultSourceChange
}: Props) {
  const [newSource, setNewSource] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});

  function addSource() {
    const value = newSource.trim();
    if (!value || sources.includes(value)) return;
    onSourcesChange([...sources, value]);
    setNewSource('');
  }

  function addCategory() {
    const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    onCategoriesChange([...categories, value]);
    onSubcategoriesChange({ ...subcategories, [value]: ['Other'] });
    setNewCategory('');
  }

  function addSubcategory(category: string) {
    const value = (newSubcategory[category] ?? '').trim();
    if (!value || (subcategories[category] ?? []).includes(value)) return;
    onSubcategoriesChange({
      ...subcategories,
      [category]: [...(subcategories[category] ?? []), value]
    });
    setNewSubcategory((current) => ({ ...current, [category]: '' }));
  }

  return (
    <section className="settings-panel label-manager">
      <div>
        <p className="eyebrow">Manage labels</p>
        <h2>Sources, categories & subcategories</h2>
        <p className="subtle compact-copy">These stay local to this device for now and immediately update Quick Add and budget widgets.</p>
      </div>

      <div className="label-manager-block">
        <div className="section-head">
          <strong>Sources</strong>
          <label className="default-source-select">
            Default
            <select value={defaultSource} onChange={(event) => onDefaultSourceChange(event.target.value)}>
              {sources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
        </div>

        <div className="label-list">
          {sources.map((source, index) => (
            <div className="label-row" key={source}>
              <span>{source}</span>
              <div className="label-row-actions">
                <button className="icon-button" type="button" disabled={index === 0} onClick={() => onSourcesChange(move(sources, index, -1))}>↑</button>
                <button className="icon-button" type="button" disabled={index === sources.length - 1} onClick={() => onSourcesChange(move(sources, index, 1))}>↓</button>
                <button
                  className="icon-button danger-mini"
                  type="button"
                  disabled={sources.length === 1 || source === defaultSource}
                  onClick={() => onSourcesChange(sources.filter((item) => item !== source))}
                  aria-label={`Archive ${source}`}
                >×</button>
              </div>
            </div>
          ))}
        </div>

        <div className="inline-add">
          <input value={newSource} onChange={(event) => setNewSource(event.target.value)} placeholder="Add source" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSource(); } }} />
          <button className="button primary" type="button" onClick={addSource}>Add</button>
        </div>
      </div>

      <div className="label-manager-block">
        <strong>Categories</strong>
        <div className="category-manager-grid">
          {categories.map((category, index) => (
            <article className="category-manager-card" key={category}>
              <div className="section-head">
                <strong>{category}</strong>
                <div className="label-row-actions">
                  <button className="icon-button" type="button" disabled={index === 0} onClick={() => onCategoriesChange(move(categories, index, -1))}>↑</button>
                  <button className="icon-button" type="button" disabled={index === categories.length - 1} onClick={() => onCategoriesChange(move(categories, index, 1))}>↓</button>
                  <button
                    className="icon-button danger-mini"
                    type="button"
                    disabled={categories.length === 1}
                    onClick={() => {
                      onCategoriesChange(categories.filter((item) => item !== category));
                      const next = { ...subcategories };
                      delete next[category];
                      onSubcategoriesChange(next);
                    }}
                    aria-label={`Archive ${category}`}
                  >×</button>
                </div>
              </div>

              <div className="subcategory-wrap">
                {(subcategories[category] ?? []).map((subcategory) => (
                  <span className="subcategory-chip" key={subcategory}>
                    {subcategory}
                    {(subcategories[category] ?? []).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onSubcategoriesChange({
                          ...subcategories,
                          [category]: subcategories[category].filter((item) => item !== subcategory)
                        })}
                        aria-label={`Archive ${subcategory}`}
                      >×</button>
                    ) : null}
                  </span>
                ))}
              </div>

              <div className="inline-add compact">
                <input
                  value={newSubcategory[category] ?? ''}
                  onChange={(event) => setNewSubcategory((current) => ({ ...current, [category]: event.target.value }))}
                  placeholder="Add subcategory"
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubcategory(category); } }}
                />
                <button className="button" type="button" onClick={() => addSubcategory(category)}>Add</button>
              </div>
            </article>
          ))}
        </div>

        <div className="inline-add">
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Add category" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCategory(); } }} />
          <button className="button primary" type="button" onClick={addCategory}>Add</button>
        </div>
      </div>
    </section>
  );
}
