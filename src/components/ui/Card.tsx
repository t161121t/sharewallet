import type { ReactNode } from "react";
import { Card as KonstaCard } from "konsta/react";

type CardProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentWrapPadding?: string;
};

export default function Card({
  children,
  header,
  footer,
  className = "",
  contentWrapPadding,
}: CardProps) {
  return (
    <KonstaCard
      header={header}
      footer={footer}
      contentWrapPadding={contentWrapPadding}
      className={["rounded-[var(--radius-card)] overflow-hidden", className].filter(Boolean).join(" ")}
    >
      {children}
    </KonstaCard>
  );
}
