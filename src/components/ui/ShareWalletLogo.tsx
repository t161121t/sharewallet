import type { SVGProps } from "react";

type ShareWalletLogoProps = SVGProps<SVGSVGElement> & {
  /** アイコン部分のサイズ (px) */
  size?: number;
  /** "ShareWallet" テキストを表示するか */
  showText?: boolean;
};

/**
 * ハート型財布ロゴ（SVG）
 *
 * 丸みが強くかわいいハート型。ほっぺのブラッシュとスパークル装飾付き。
 */
export default function ShareWalletLogo({
  size = 120,
  showText = false,
  ...rest
}: ShareWalletLogoProps) {
  const textHeight = showText ? 32 : 0;
  const totalHeight = size + (showText ? 8 + textHeight : 0);

  return (
    <svg
      width={size}
      height={totalHeight}
      viewBox={`0 0 120 ${showText ? 158 : 120}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ShareWallet ロゴ"
      {...rest}
    >
      <defs>
        {/* メインゴールド — 暖かみのあるアンバー系 */}
        <linearGradient id="sw-gold" x1="18" y1="8" x2="102" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#FFE87A" />
          <stop offset="0.3"  stopColor="#F5C538" />
          <stop offset="0.65" stopColor="#D49018" />
          <stop offset="1"    stopColor="#B86A08" />
        </linearGradient>

        {/* トップハイライト */}
        <linearGradient id="sw-highlight" x1="22" y1="8" x2="62" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFCE0" stopOpacity="0.75" />
          <stop offset="1" stopColor="#F5C538" stopOpacity="0" />
        </linearGradient>

        {/* エッジシャドウ */}
        <radialGradient id="sw-edge" cx="50%" cy="45%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0.45" stopColor="transparent" />
          <stop offset="1"    stopColor="#7A4400" stopOpacity="0.22" />
        </radialGradient>

        {/* コイングラデーション */}
        <radialGradient id="sw-coin" cx="38%" cy="32%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0"   stopColor="#FFF0A0" />
          <stop offset="0.5" stopColor="#EAA818" />
          <stop offset="1"   stopColor="#B86808" />
        </radialGradient>
      </defs>

      {/* ===== 丸みUP！かわいいハート外形 ===== */}
      <path
        d="
          M60 107
          C51 97, 14 79, 9 55
          C4 33, 19 11, 41 11
          C52 11, 58 20, 60 30
          C62 20, 68 11, 79 11
          C101 11, 116 33, 111 55
          C106 79, 69 97, 60 107
          Z
        "
        fill="url(#sw-gold)"
        stroke="#C07200"
        strokeWidth="1.2"
      />
      {/* トップハイライトレイヤー */}
      <path
        d="
          M60 107
          C51 97, 14 79, 9 55
          C4 33, 19 11, 41 11
          C52 11, 58 20, 60 30
          C62 20, 68 11, 79 11
          C101 11, 116 33, 111 55
          C106 79, 69 97, 60 107
          Z
        "
        fill="url(#sw-highlight)"
      />
      {/* エッジシャドウレイヤー */}
      <path
        d="
          M60 107
          C51 97, 14 79, 9 55
          C4 33, 19 11, 41 11
          C52 11, 58 20, 60 30
          C62 20, 68 11, 79 11
          C101 11, 116 33, 111 55
          C106 79, 69 97, 60 107
          Z
        "
        fill="url(#sw-edge)"
      />

      {/* ===== 左の財布フタ（丸くかわいく） ===== */}
      <path
        d="M19 38 C19 28, 27 21, 40 21 L52 21 C59 21, 59 29, 59 36 L19 36 Z"
        fill="#D49018"
        stroke="#B87000"
        strokeWidth="0.8"
      />
      <line x1="24" y1="30" x2="54" y2="30" stroke="white" strokeWidth="1.1" strokeOpacity="0.4" />
      {/* 左フタの丸みライン */}
      <path d="M22 24 C28 19, 36 18, 44 19" stroke="white" strokeWidth="0.8" strokeOpacity="0.3" fill="none" strokeLinecap="round" />

      {/* ===== 右の財布フタ ===== */}
      <path
        d="M61 36 C61 29, 61 21, 68 21 L80 21 C93 21, 101 28, 101 38 L61 36 Z"
        fill="#D49018"
        stroke="#B87000"
        strokeWidth="0.8"
      />
      <line x1="66" y1="30" x2="96" y2="30" stroke="white" strokeWidth="1.1" strokeOpacity="0.4" />
      <path d="M98 24 C92 19, 84 18, 76 19" stroke="white" strokeWidth="0.8" strokeOpacity="0.3" fill="none" strokeLinecap="round" />

      {/* 中央の仕切りライン */}
      <line x1="60" y1="28" x2="60" y2="88" stroke="white" strokeWidth="1.3" strokeOpacity="0.3" />

      {/* ===== ほっぺのブラッシュ（キュートポイント！）===== */}
      <ellipse cx="21" cy="60" rx="9"  ry="6"  fill="#FF9060" opacity="0.28" />
      <ellipse cx="99" cy="60" rx="9"  ry="6"  fill="#FF9060" opacity="0.28" />

      {/* ===== 中央コイン（大きめ・キラキラ）===== */}
      <circle cx="60" cy="72" r="14" fill="#B86808" stroke="#8A4E00" strokeWidth="1.2" />
      <circle cx="60" cy="72" r="11" fill="url(#sw-coin)" />
      <circle cx="60" cy="72" r="7"  fill="#F5C538" opacity="0.9" />
      {/* ¥ マーク */}
      <text
        x="60"
        y="72"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#7A4400"
        style={{ fontSize: 9, fontWeight: 800 }}
      >
        ¥
      </text>
      {/* コインのキラリ */}
      <circle cx="55" cy="67" r="2.2" fill="white" opacity="0.4" />
      <circle cx="57" cy="66" r="0.9" fill="white" opacity="0.6" />

      {/* ===== スパークル装飾 ===== */}
      {/* 左上 大 */}
      <path
        d="M17 19 L18.8 14 L20.6 19 L25.6 20.8 L20.6 22.6 L18.8 27.6 L17 22.6 L12 20.8 Z"
        fill="#FFE87A"
        opacity="0.95"
      />
      {/* 右上 大 */}
      <path
        d="M99.4 19 L101.2 14 L103 19 L108 20.8 L103 22.6 L101.2 27.6 L99.4 22.6 L94.4 20.8 Z"
        fill="#FFE87A"
        opacity="0.95"
      />
      {/* 右中 小 */}
      <path
        d="M97 72 L98 69.5 L99 72 L101.5 73 L99 74 L98 76.5 L97 74 L94.5 73 Z"
        fill="#FFE87A"
        opacity="0.75"
      />
      {/* 左中 小 */}
      <path
        d="M23 72 L24 69.5 L25 72 L27.5 73 L25 74 L24 76.5 L23 74 L20.5 73 Z"
        fill="#FFE87A"
        opacity="0.75"
      />
      {/* ランダムドット */}
      <circle cx="32" cy="90" r="1.5" fill="#FFE87A" opacity="0.5" />
      <circle cx="88" cy="90" r="1.5" fill="#FFE87A" opacity="0.5" />
      <circle cx="14" cy="42" r="1.2" fill="#FFE87A" opacity="0.45" />
      <circle cx="106" cy="42" r="1.2" fill="#FFE87A" opacity="0.45" />

      {/* ===== テキスト ===== */}
      {showText && (
        <text
          x="60"
          y="144"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#3D3D3D"
          style={{
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Geist Sans', system-ui, sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          ShareWallet
        </text>
      )}
    </svg>
  );
}
