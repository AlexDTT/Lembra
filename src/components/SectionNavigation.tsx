import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/context';
import { useCopy } from '../i18n/ux';
import { Icon } from './Icon';

export function SectionNavigation({
  section,
}: {
  section: 'calendar' | 'money';
}) {
  const { t } = useI18n();
  const copy = useCopy();
  const links =
    section === 'calendar'
      ? ([
          ['/calendar', 'calendar', 'calendar'],
          ['/appointments', 'appointments', 'clock'],
        ] as const)
      : ([
          ['/money', 'money', 'wallet'],
          ['/bills', 'bills', 'receipt'],
        ] as const);
  return (
    <nav
      className="section-navigation"
      aria-label={
        section === 'calendar' ? copy.calendarNavigation : copy.moneyNavigation
      }
    >
      {links.map(([to, label, icon]) => (
        <NavLink key={to} to={to}>
          <Icon name={icon} size={18} />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
