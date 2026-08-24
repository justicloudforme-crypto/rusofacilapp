// Small stroke-based icon set for the profile page's section headers and
// tab nav — one icon per section, so the dashboard reads as a real
// interface (icon + label per row) instead of a list of plain-text
// headings. Deliberately hand-rolled inline SVGs (currentColor, 24x24
// viewBox, ~1.75 stroke) rather than pulling in an icon library dependency
// — same approach the app already uses for TelegramFloatButton and the
// profile streak flame.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function PersonalIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  );
}

export function AppearanceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5 8 12l4-6.5 4 6.5 4-3.5-1.4 9.5H5.4L4 8.5Z" strokeLinejoin="round" />
      <path d="M5.5 18.5h13" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4a3 3 0 0 0 3 5.5M17 5.5h3a3 3 0 0 1-3 5.5" />
      <path d="M12 13.5v3M8.5 20.5h7M9.5 16.5h5l.6 4h-6.2l.6-4Z" strokeLinejoin="round" />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M4 12.5h16M12 9v11" />
      <path d="M12 9C10 9 8.5 7.8 8.5 6.3 8.5 5 9.5 4 10.7 4c1.3 0 1.9 1.4 1.3 3.2M12 9c2 0 3.5-1.2 3.5-2.7C15.5 5 14.5 4 13.3 4c-1.3 0-1.9 1.4-1.3 3.2" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.3" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DevicesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="13" height="9" rx="1" />
      <path d="M3 17h13" />
      <rect x="17" y="9.5" width="4.5" height="8" rx="1" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7h14M9.5 7V5.2c0-.7.6-1.2 1.2-1.2h2.6c.7 0 1.2.6 1.2 1.2V7" />
      <path d="M6.5 7 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10M10 20V4M16 20v-7M20.5 20H3.5" />
    </svg>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.5 6 8l2.5-3" />
      <path d="M4.5 13.5 6 15l2.5-3" />
      <path d="M4.5 20.5 6 22l2.5-3" />
      <path d="M12.5 6.5h7M12.5 14h7M12.5 20.5h7" />
    </svg>
  );
}

export function GraduationCapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 9.5 12 5l9.5 4.5-9.5 4.5-9.5-4.5Z" strokeLinejoin="round" />
      <path d="M6.5 11.7v4.3c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.3M20.5 10v6" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5c1.8-1 4.4-1.2 6.5-.3 .9.4 1.5 1 1.5 1.7v12.6c0-.7-.6-1.3-1.5-1.7-2.1-.9-4.7-.7-6.5.3V5.5Z" />
      <path d="M20 5.5c-1.8-1-4.4-1.2-6.5-.3-.9.4-1.5 1-1.5 1.7v12.6c0-.7.6-1.3 1.5-1.7 2.1-.9 4.7-.7 6.5.3V5.5Z" />
    </svg>
  );
}
