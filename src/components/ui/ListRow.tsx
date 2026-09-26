import type { ReactNode } from "react";
import { ListItem } from "konsta/react";

type ListRowProps = {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
  /** タイトル部分の折り返し・truncate調整用(長いURLなどを`truncate`させたい場合) */
  titleWrapClassName?: string;
  /** 行内部コンテナのクラス(縦位置の調整など) */
  innerClassName?: string;
};

/** iOSのGrouped List行(アイコン+ラベル+chevron)。`<List>`の子として使う */
export default function ListRow({
  icon,
  title,
  subtitle,
  after,
  href,
  onClick,
  chevron,
  className = "",
  titleWrapClassName,
  innerClassName,
}: ListRowProps) {
  return (
    <ListItem
      media={icon}
      title={title}
      subtitle={subtitle}
      after={after}
      link={Boolean(href || onClick)}
      href={href}
      onClick={onClick}
      chevron={chevron ?? Boolean(href || onClick)}
      className={className}
      titleWrapClassName={titleWrapClassName}
      innerClassName={innerClassName}
    />
  );
}
