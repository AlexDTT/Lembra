import {
  Children,
  isValidElement,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { Chip, Collapse } from '@mui/material';
import { Card, Button } from './ui';
import { Icon, type IconName } from './Icon';
import { useExplore } from '../i18n/explore';
import { SelectField } from './SelectField';
type FilterSelectProps = {
  label: string;
  resetValue?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
};
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options.map(([value, label]) => ({ value, label }))}
    />
  );
}
export function FilterPanel({
  children,
  count,
  onReset,
  results,
  title,
  quickFilters,
  onSearchClear,
  extraChips = [],
}: {
  children: ReactNode;
  count: number;
  onReset: () => void;
  results?: number;
  title?: string;
  quickFilters?: ReactNode;
  onSearchClear?: () => void;
  extraChips?: { label: string; onRemove: () => void }[];
}) {
  const copy = useExplore();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const controls = Children.toArray(children);
  const chips = controls.slice(1).flatMap((control) => {
    if (
      !isValidElement<FilterSelectProps>(control) ||
      control.type !== FilterSelect
    )
      return [];
    const {
      label,
      value,
      options,
      onChange,
      resetValue = options[0]?.[0],
    } = control.props;
    if (value === resetValue) return [];
    return [
      {
        label: `${label}: ${options.find(([key]) => key === value)?.[1] || value}`,
        onRemove: () => onChange(resetValue),
      },
    ];
  });
  const searchValue = isValidElement<{ value: string }>(controls[0])
    ? controls[0].props.value
    : '';
  const applied = [
    ...(searchValue && onSearchClear
      ? [{ label: `“${searchValue}”`, onRemove: onSearchClear }]
      : []),
    ...chips,
    ...extraChips,
  ];
  return (
    <Card className="filter-panel">
      <header>
        <h2>
          <Icon name="settings" size={18} />
          {title || copy.filters}
          {count > 0 && <span className="pill">{count}</span>}
        </h2>
        <Button variant="secondary" disabled={!count} onClick={onReset}>
          {copy.clear}
        </Button>
      </header>
      <div className="filter-primary">{controls[0]}</div>
      {quickFilters && (
        <div className="quick-filter-options">{quickFilters}</div>
      )}
      {applied.length > 0 && (
        <div className="applied-filters" aria-label={copy.activeFilters}>
          {applied.map((chip) => (
            <Chip
              key={chip.label}
              size="small"
              label={chip.label}
              onDelete={chip.onRemove}
            />
          ))}
        </div>
      )}
      {controls.length > 1 && (
        <>
          <Button
            className="more-filters"
            variant="secondary"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon name="settings" size={18} />
            {expanded ? copy.lessFilters : copy.moreFilters}
          </Button>
          <Collapse in={expanded}>
            <div id={id} className="filter-grid">
              {controls.slice(1)}
            </div>
          </Collapse>
        </>
      )}
      {results !== undefined && (
        <p className="filter-results" role="status">
          {results} {copy.results} · {copy.selection.toLocaleLowerCase()}
        </p>
      )}
    </Card>
  );
}
export function Statistics({
  items,
  label,
}: {
  items: {
    label: string;
    value: string | number;
    hint?: string;
    icon: IconName;
  }[];
  label?: string;
}) {
  const copy = useExplore();
  return (
    <section
      aria-label={label || copy.selection}
      className="statistics-section"
    >
      <div className="stat-grid">
        {items.map((item) => (
          <Card className="stat-card" key={item.label}>
            <p>
              <Icon name={item.icon} />
              {item.label}
            </p>
            <h2>{item.value}</h2>
            {item.hint && <span>{item.hint}</span>}
          </Card>
        ))}
      </div>
    </section>
  );
}

export function QuickFilters({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="quick-filter-group" role="group" aria-label={label}>
      {options.map(([key, title]) => (
        <Chip
          component="button"
          type="button"
          key={key}
          label={title}
          clickable
          aria-pressed={value === key}
          variant={value === key ? 'filled' : 'outlined'}
          color={value === key ? 'primary' : 'default'}
          onClick={() => onChange(key)}
        />
      ))}
    </div>
  );
}
