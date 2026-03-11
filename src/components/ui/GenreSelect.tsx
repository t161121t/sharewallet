type GenreSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

const GENRE_OPTIONS = [
  { value: "", label: "ジャンル" },
  { value: "食費", label: "食費" },
  { value: "交通", label: "交通費" },
  { value: "住居", label: "住居費" },
  { value: "日用品", label: "日用品" },
  { value: "娯楽", label: "娯楽" },
  { value: "通信", label: "通信費" },
  { value: "医療", label: "医療費" },
  { value: "美容", label: "美容" },
  { value: "教育", label: "教育" },
  { value: "貯金", label: "貯金" },
  { value: "その他", label: "その他" },
];

export default function GenreSelect({ value, onChange }: GenreSelectProps) {
  return (
    <label className="w-full">
      <div className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-2">
        ジャンル
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full h-13 rounded-xl px-4 outline-none appearance-none cursor-pointer text-base",
          "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
          "text-[#2d2a26] dark:text-[#eae7e1]",
          "transition-all duration-200 ease-out",
          "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
        ].join(" ")}
        aria-label="ジャンルを選択"
      >
        {GENRE_OPTIONS.map((opt) => (
          <option key={opt.value || "empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
