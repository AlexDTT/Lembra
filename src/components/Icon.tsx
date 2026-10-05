import type { CSSProperties } from 'react';
export type IconName =
  | 'menu'
  | 'home'
  | 'calendar'
  | 'wallet'
  | 'plus'
  | 'settings'
  | 'pill'
  | 'check'
  | 'clock'
  | 'arrow'
  | 'chevron'
  | 'bell'
  | 'photo'
  | 'edit'
  | 'trash'
  | 'close'
  | 'location'
  | 'receipt'
  | 'shield'
  | 'sun'
  | 'moon'
  | 'logout';
const paths: Record<IconName, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  calendar:
    'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 14h2m4 0h2m-8 4h2',
  wallet:
    'M20 7H5a2 2 0 0 1 0-4h13v4m2 0a1 1 0 0 1 1 1v12H5a2 2 0 0 1-2-2V5m18 7h-6v5h6m-3-2.5h.01',
  plus: 'M12 5v14M5 12h14',
  settings:
    'm9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Zm0 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  pill: 'm10 4-6 6a6 6 0 0 0 8 8l6-6a6 6 0 0 0-8-8M7 7l10 10',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  bell: 'M18 8a6 6 0 0 0-12 0v6l-2 3h16l-2-3ZM10 21h4',
  photo: 'M3 5h5l2-2h4l2 2h5v15H3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  edit: 'm15 4 5 5M4 20l1-6L16 3l5 5L10 19Zm0 0h8',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  close: 'm6 6 12 12M6 18 18 6',
  location:
    'M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 1 1 14 0M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  receipt:
    'M5 3l2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1ZM9 8h6m-6 4h6m-6 4h3',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 10 3 3 7-7',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10',
  logout: 'M9 3H4v18h5m5-14 5 5-5 5m-6-5h11',
};
export function Icon({
  name,
  size = 22,
  style,
  className = '',
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
