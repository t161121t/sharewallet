"use client";

import Image from "next/image";

type GroupAvatarProps = {
  name: string;
  color: string;
  iconUrl?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function GroupAvatar({
  name,
  color,
  iconUrl,
  size = 40,
  className = "",
  style,
}: GroupAvatarProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl overflow-hidden shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: iconUrl ? undefined : color,
        ...style,
      }}
      title={name}
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={name}
          width={size}
          height={size}
          unoptimized
          className="object-cover w-full h-full"
        />
      ) : (
        <svg viewBox="0 0 24 24" fill="white" width={Math.round(size * 0.55)} height={Math.round(size * 0.55)}>
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      )}
    </span>
  );
}
