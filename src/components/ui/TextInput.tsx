type TextInputProps = {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
};

export default function TextInput({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
}: TextInputProps) {
  return (
    <label className="w-full">
      <div className="text-sm font-semibold text-[#4a4540] dark:text-[#c5c0b8] mb-1.5 transition-colors duration-200">
        {label}
      </div>
      <input
        className={[
          "w-full h-12 rounded-xl px-4 outline-none text-base",
          "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
          "text-[#2d2a26] dark:text-[#eae7e1]",
          "placeholder:text-[#b5b0a8] dark:placeholder:text-[#666360]",
          "transition-all duration-200 ease-out",
          disabled ? "opacity-60 cursor-not-allowed" : "",
          error
            ? "ring-2 ring-red-400 focus:ring-red-500"
            : "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
        ].join(" ")}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1 animate-[fade-in-up_0.2s_ease-out]">
          {error}
        </p>
      )}
    </label>
  );
}
