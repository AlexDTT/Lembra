import type { CSSProperties } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { useI18n } from '../i18n/context';
import { formatMoney } from '../lib/money';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);
export function InsightChart({
  title,
  labels,
  series,
  money = false,
  line = false,
}: {
  title: string;
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  money?: boolean;
  line?: boolean;
}) {
  const { t, locale } = useI18n();
  const format = (value: number) =>
    money
      ? formatMoney(value, locale)
      : new Intl.NumberFormat(locale).format(value);
  const data = {
    labels,
    datasets: series.map((item) => ({
      label: item.name,
      data: item.values,
      backgroundColor: line ? `${item.color}14` : item.color,
      borderColor: item.color,
      borderWidth: line ? 2 : 0,
      borderRadius: 4,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
      fill: line,
    })),
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: {
            dataset: { label?: string };
            parsed: { y: number | null };
          }) => `${context.dataset.label}: ${format(context.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#68615a', maxTicksLimit: 7, font: { size: 14 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#eee8e1' },
        ticks: {
          color: '#68615a',
          precision: 0,
          font: { size: 14 },
          callback: (value: string | number) => format(Number(value)),
        },
      },
    },
  };
  return (
    <>
      <div className="chart-legend">
        {series.map((item) => (
          <span
            className="legend-item"
            style={{ '--legend-color': item.color } as CSSProperties}
            data-color={item.color}
            key={item.name}
          >
            {item.name}
          </span>
        ))}
      </div>
      <div className="insight-chart">
        {line ? (
          <Line role="img" aria-label={title} data={data} options={options} />
        ) : (
          <Bar role="img" aria-label={title} data={data} options={options} />
        )}
      </div>
      <details className="chart-data">
        <summary>{t('showChartData')}</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t('date')}</th>
                {series.map((item) => (
                  <th scope="col" key={item.name}>
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => (
                <tr key={`${label}:${index}`}>
                  <th scope="row">{label}</th>
                  {series.map((item) => (
                    <td key={item.name}>{format(item.values[index])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
