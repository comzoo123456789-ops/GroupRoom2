// 라인 아이콘 (stroke 1.6, currentColor) — 통일된 미니멀 아이콘 세트
import type { FC } from "react";

interface P {
  size?: number;
}
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconGrid = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconCalendar = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);
export const IconChart = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
export const IconMap = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3zM9 3v15M15 5.5v15" />
  </svg>
);
export const IconUsers = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M16 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
);
export const IconSettings = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.8 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);
export const IconTv = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
export const IconWhiteboard = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M12 16v4M8 20h8M8 8l3 3 4-4" />
  </svg>
);
export const IconCam = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="2.5" y="6" width="13" height="12" rx="2" />
    <path d="m15.5 10 6-3.5v11L15.5 14" />
  </svg>
);
export const IconBolt = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);
export const IconWifi = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 12.5a10 10 0 0 1 14 0M8 16a5 5 0 0 1 8 0" />
    <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
  </svg>
);

export const IconPencil = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);
export const IconClock = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconX = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const amenityIcon: Record<string, FC<P>> = {
  tv: IconTv,
  whiteboard: IconWhiteboard,
  cam: IconCam,
};
