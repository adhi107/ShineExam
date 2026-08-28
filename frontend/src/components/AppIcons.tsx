import React from "react";

type IconName =
  | "dashboard"
  | "users"
  | "admin"
  | "tests"
  | "results"
  | "courses"
  | "maintenance"
  | "history"
  | "completed"
  | "score"
  | "security"
  | "trophy"
  | "streak"
  | "categories"
  | "documents"
  | "videos"
  | "violations"
  | "audit"
  | "controls";

interface AppIconProps {
  name: IconName;
  className?: string;
}

const iconPaths: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M4 13.5h6.5V20H4z" />
      <path d="M13.5 4H20v9.5h-6.5z" />
      <path d="M4 4h6.5v6.5H4z" />
      <path d="M13.5 16.5H20V20h-6.5z" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M6 19a6 6 0 0 1 12 0" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M6 19a6 6 0 0 1 12 0" />
      <path d="m18.25 5.25.7.35.7-.35-.35.7.35.7-.7-.35-.7.35.35-.7-.35-.7Z" />
    </>
  ),
  tests: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M7 7h10" />
      <path d="M7 11h10" />
      <path d="M7 15h6" />
      <path d="M5.5 7h.01" />
      <path d="M5.5 11h.01" />
      <path d="M5.5 15h.01" />
    </>
  ),
  results: (
    <>
      <path d="M5 19V9" />
      <path d="M10 19V5" />
      <path d="M15 19v-7" />
      <path d="M20 19V3" />
    </>
  ),
  courses: (
    <>
      <path d="M12 6 4 10l8 4 8-4-8-4Z" />
      <path d="M7 12.5V16l5 2.5 5-2.5v-3.5" />
    </>
  ),
  maintenance: (
    <>
      <path d="m14.5 6.5 3 3" />
      <path d="m5 19 4.5-1 9-9a2.1 2.1 0 1 0-3-3l-9 9L5 19Z" />
      <path d="M12 8 16 12" />
    </>
  ),
  history: (
    <>
      <path d="M12 7v5l3 2" />
      <path d="M20 12a8 8 0 1 1-2.35-5.65" />
      <path d="M20 4v5h-5" />
    </>
  ),
  completed: <path d="M5 12.5 9.5 17 19 7.5" />,
  score: (
    <>
      <path d="M5 17a7 7 0 1 1 14 0" />
      <path d="m12 12 4-4" />
      <path d="M12 12h.01" />
    </>
  ),
  security: (
    <>
      <path d="M12 3 6 5.5v5.5c0 4 2.6 7.6 6 9 3.4-1.4 6-5 6-9V5.5L12 3Z" />
      <path d="M10 11.5V10a2 2 0 1 1 4 0v1.5" />
      <rect x="9" y="11.5" width="6" height="4.5" rx="1" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M10 16h4" />
      <path d="M12 11v5" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4" />
      <path d="M17 5h3v1a4 4 0 0 1-4 4" />
      <path d="M9 20h6" />
    </>
  ),
  streak: <path d="M13 3c.5 2.5-.5 4.5-2 6 2-.5 4.5.5 5.5 2.5 1.5 3-1 6.5-4.5 7.5-3.5 1-7-1-8-4.5C3 10 7.5 7.5 9 4.5A5 5 0 0 1 13 3Z" />,
  categories: (
    <><rect x="3.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="14" y="4" width="6.5" height="6.5" rx="1" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" /><rect x="14" y="14" width="6.5" height="6.5" rx="1" /></>
  ),
  documents: (
    <><path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5V8h4" /><path d="M8 12h7M8 15.5h7M8 19h4" /></>
  ),
  videos: (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  violations: (
    <>
      <path d="M12 3 4 19h16L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </>
  ),
  audit: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  controls: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

const AppIcon: React.FC<AppIconProps> = ({ name, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {iconPaths[name] || iconPaths.dashboard}
  </svg>
);

export default AppIcon;
