import React from 'react';

interface AppIconProps {
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ className = 'w-7 h-7' }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="15" className="fill-zinc-900 dark:fill-[#0c0c0e]" />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="13"
        className="stroke-zinc-700 dark:stroke-zinc-800"
        strokeWidth="2"
      />
      <path
        d="M32 11L15 18V30.2C15 41.8 22.2 52.1 32 55.2C41.8 52.1 49 41.8 49 30.2V18L32 11Z"
        className="fill-zinc-800 dark:fill-zinc-900 stroke-white"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="28" r="2.8" className="fill-white" />
      <circle cx="40" cy="24" r="2.8" className="fill-white" />
      <path
        d="M24 28L32 21.5L40 24"
        className="stroke-zinc-400"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35" cy="36.5" r="8.5" className="fill-emerald-500" />
      <path
        d="M31.2 36.7L33.9 39.4L39.2 34"
        stroke="#050507"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
