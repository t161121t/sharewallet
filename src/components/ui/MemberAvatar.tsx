"use client";

import Image from "next/image";

type MemberAvatarProps = {
  name: string;
  color: string;
  avatarUrl?: string;
  /** px size (width = height) */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function MemberAvatar({
  name,
  color,
  avatarUrl,
  size = 28,
  className = "",
  style,
}: MemberAvatarProps) {
  const fontSize = Math.max(10, Math.round(size * 0.38));

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: avatarUrl ? undefined : color,
        ...style,
      }}
      title={name}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          unoptimized
          className="object-cover w-full h-full"
        />
      ) : (
        <span
          className="font-bold text-white leading-none select-none"
          style={{ fontSize }}
        >
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}
