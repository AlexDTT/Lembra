import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useI18n } from '../../i18n/context';
import { formatMoney } from '../../lib/money';
ChartJS.register(ArcElement, Tooltip);
export function SpendingChart({
  items,
}: {
  items: { name: string; cents: number }[];
}) {
  const { t, locale } = useI18n();
  if (!items.some((item) => item.cents > 0)) return null;
  return (
    <div className="spending-chart">
      <Doughnut
        role="img"
        aria-label={t('spendingByCategory')}
        data={{
          labels: items.map((item) => item.name),
          datasets: [
            {
              data: items.map((item) => item.cents),
              backgroundColor: [
                '#ad3829',
                '#53744a',
                '#44708c',
                '#b28631',
                '#78618d',
                '#8b6250',
              ],
              borderColor: '#fff',
              borderWidth: 3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          cutout: '72%',
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => formatMoney(Number(context.raw), locale),
              },
            },
          },
        }}
      />
    </div>
  );
}
