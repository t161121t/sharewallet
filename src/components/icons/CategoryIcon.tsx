import type { SVGProps } from "react";
import type { CategoryName } from "@/types";

export type { CategoryName };

type CategoryIconProps = SVGProps<SVGSVGElement> & {
  /** カテゴリ名 */
  category: CategoryName;
  /** px サイズ（width = height） */
  size?: number;
};

/* ---------- 各カテゴリの SVG path ---------- */

function SavingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M15.5 2A4.5 4.5 0 0011 6.5c0 .66.15 1.29.41 1.85L4 15.77V22h4v-2h2v-2h2l2.79-2.79c.56.26 1.19.41 1.85.41.07 0 .14 0 .21-.01A4.49 4.49 0 0020 11a4.5 4.5 0 00-4.5-4.5zm.5 6a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

function HousingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function TransportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c-4.42 0-8 .5-8 4v9c0 1.1.9 2 2 2v3h2v-3h8v3h2v-3c1.1 0 2-.9 2-2V6c0-3.5-3.58-4-8-4zm0 2c3.91 0 6 .37 6 2H6c0-1.63 2.09-2 6-2zM6 8h12v4H6V8zm1.5 6.5A1.5 1.5 0 119 13a1.5 1.5 0 01-1.5 1.5zm9 0A1.5 1.5 0 1118 13a1.5 1.5 0 01-1.5 1.5z" />
    </svg>
  );
}

function FoodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
    </svg>
  );
}

function EntertainmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

function MedicalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
    </svg>
  );
}

function DailyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

function TelecomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M15.5 1h-8A2.5 2.5 0 005 3.5v17A2.5 2.5 0 007.5 23h8a2.5 2.5 0 002.5-2.5v-17A2.5 2.5 0 0015.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z" />
    </svg>
  );
}

function BeautyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C14.5 2.12 13.38 1 12 1S9.5 2.12 9.5 3.5l.02.19c-.4-.28-.89-.44-1.42-.44-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25zM12 5.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8s1.12-2.5 2.5-2.5zM3 13c0 4.97 4.03 9 9 9 0-4.97-4.03-9-9-9z" />
    </svg>
  );
}

function EducationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
    </svg>
  );
}

function OtherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
    </svg>
  );
}

/* ---------- カテゴリ → コンポーネント マップ ---------- */

const ICON_MAP: Record<CategoryName, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  貯金: SavingsIcon,
  住居: HousingIcon,
  交通: TransportIcon,
  食費: FoodIcon,
  娯楽: EntertainmentIcon,
  医療: MedicalIcon,
  日用品: DailyIcon,
  通信: TelecomIcon,
  美容: BeautyIcon,
  教育: EducationIcon,
  その他: OtherIcon,
};

/**
 * カテゴリ名からアイコンを描画する汎用コンポーネント。
 *
 * @example
 * <CategoryIcon category="食費" size={20} className="text-red-500" />
 */
export default function CategoryIcon({
  category,
  size = 20,
  ...rest
}: CategoryIconProps) {
  const normalizedCategory =
    category === ("交通費" as CategoryName)
      ? "交通"
      : category === ("住居費" as CategoryName)
        ? "住居"
        : category;
  const Icon = ICON_MAP[normalizedCategory] ?? OtherIcon;
  return <Icon width={size} height={size} aria-hidden {...rest} />;
}
