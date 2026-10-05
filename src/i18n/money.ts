import { useI18n } from './context';

const pt = {
  monthView: 'Mês',
  yearView: 'Ano',
  year: 'Ano',
  choosePeriod: 'Escolher período',
  viewYear: 'Ver ano completo',
  currentMonth: 'Mês atual',
  readOnly:
    'Este período é apenas para consulta. Para adicionar ou alterar despesas e orçamentos, volte ao mês atual.',
  currentMonthOnly: 'Só pode adicionar ou alterar despesas do mês atual.',
  yearOverview: 'Resumo do ano completo',
  yearHelp:
    'O resumo inclui todas as despesas do ano. Os filtros aplicam-se à lista e aos gráficos.',
  yearSpending: 'Despesas por mês',
  yearChartHelp:
    'Valores registados nesta seleção. Escolha um mês para ver os seus detalhes.',
  monthsWithExpenses: 'Meses com despesas',
  spent: 'Total gasto no período',
  expenses: 'Despesas do período',
  empty: 'Sem despesas neste período',
  emptyHelp: 'Escolha outro período para consultar os seus registos.',
  budgetHistory:
    'Os orçamentos são limites mensais atuais. Não há um histórico de limites guardado para este período.',
};
const en: typeof pt = {
  monthView: 'Month',
  yearView: 'Year',
  year: 'Year',
  choosePeriod: 'Choose a period',
  viewYear: 'View full year',
  currentMonth: 'Current month',
  readOnly:
    'This period is read-only. Return to the current month to add or change expenses and budgets.',
  currentMonthOnly: 'You can only add or change expenses in the current month.',
  yearOverview: 'Full year overview',
  yearHelp:
    'The overview includes every expense in the year. Filters apply to the list and charts.',
  yearSpending: 'Spending by month',
  yearChartHelp:
    'Recorded amounts in this selection. Choose a month to see its details.',
  monthsWithExpenses: 'Months with expenses',
  spent: 'Total spent in the period',
  expenses: 'Expenses in this period',
  empty: 'No expenses in this period',
  emptyHelp: 'Choose another period to see your records.',
  budgetHistory:
    'Budgets are current monthly limits. There is no saved history of budget limits for this period.',
};

export function useMoneyCopy() {
  return useI18n().locale === 'en' ? en : pt;
}
