"use client";

const PALETTE = [
  { color: "#c9a227", label: "ゴールド" },
  { color: "#ef4444", label: "レッド" },
  { color: "#f97316", label: "オレンジ" },
  { color: "#f59e0b", label: "アンバー" },
  { color: "#22c55e", label: "グリーン" },
  { color: "#14b8a6", label: "ティール" },
  { color: "#38bdf8", label: "スカイ" },
  { color: "#3b82f6", label: "ブルー" },
  { color: "#6366f1", label: "インディゴ" },
  { color: "#8b5cf6", label: "バイオレット" },
  { color: "#ec4899", label: "ピンク" },
  { color: "#78716c", label: "ストーン" },
];

type ColorPaletteProps = {
  value: string;
  onChange: (color: string) => void;
};

export default function ColorPalette({ value, onChange }: ColorPaletteProps) {
  return (
    <div className="w-full">
      <div className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-3">
        テーマカラー
      </div>
      <div className="grid grid-cols-6 gap-3">
        {PALETTE.map((p) => {
          const isActive = value === p.color;
          return (
            <button
              key={p.color}
              type="button"
              onClick={() => onChange(p.color)}
              title={p.label}
              className={[
                "w-full aspect-square rounded-xl transition-all duration-150",
                isActive
                  ? "ring-2 ring-offset-2 ring-offset-[#faf8f5] dark:ring-offset-[#111110] scale-110"
                  : "hover:scale-105",
              ].join(" ")}
              style={{
                backgroundColor: p.color,
                ringColor: isActive ? p.color : undefined,
              }}
            >
              {isActive && (
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 mx-auto drop-shadow">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <div
        className="mt-3 h-2 w-full rounded-full"
        style={{ backgroundColor: value }}
      />
    </div>
  );
}
