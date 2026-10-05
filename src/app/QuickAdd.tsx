import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/context';
import { useCopy } from '../i18n/ux';
import { Icon } from '../components/Icon';
const choices = [
  ['task', 'taskNew', 'taskHelp', 'check'],
  ['medication', 'newMedication', 'addMedicationHelp', 'pill'],
  ['appointment', 'appointmentNew', 'addAppointmentHelp', 'calendar'],
  ['bill', 'billNew', 'addBillHelp', 'receipt'],
  ['expense', 'expenseNew', 'addExpenseHelp', 'wallet'],
] as const;
export function QuickAdd() {
  const { t } = useI18n();
  const copy = useCopy();
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('add')}</h1>
          <p>{copy.addHelp}</p>
        </div>
      </header>
      <div className="add-grid">
        {choices.map(([path, title, help, icon]) => (
          <Link className="add-card" key={path} to={`/add/${path}`}>
            <Icon name={icon} size={32} />
            <strong>{t(title)}</strong>
            <span>{t(help)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
