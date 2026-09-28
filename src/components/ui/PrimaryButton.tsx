import { ButtonHTMLAttributes } from "react";
import { Button } from "konsta/react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export default function PrimaryButton({
  className = "",
  loading = false,
  children,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      type="button"
      large
      rounded
      className={["w-full h-13 text-base font-semibold", className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </span>
    </Button>
  );
}
