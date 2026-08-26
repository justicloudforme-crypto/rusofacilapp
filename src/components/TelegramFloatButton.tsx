// Also used by the profile page's own Telegram card — single source of
// truth for the invite link so the two never drift apart.
export const TELEGRAM_INVITE_URL = "https://t.me/+-UhllZ_YI3dmYjdi";

// Hidden below the sm breakpoint entirely (not just shrunk) — on a real
// Android device this sat over content in the two-column mobile grids and,
// with a bottom nav bar now also occupying that screen edge
// (BottomNav.tsx), became genuine clutter rather than a helpful shortcut.
// The profile page has its own dedicated Telegram card
// (profile/page.tsx, imports TELEGRAM_INVITE_URL directly) that already
// covers the "keep the link reachable" need on mobile — this floating
// bubble stays desktop-only, where it wasn't reported as a problem.
export default function TelegramFloatButton() {
  return (
    <a
      href={TELEGRAM_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Únete al canal de Telegram de RusoFácilapp.com"
      title="Únete al canal de Telegram de RusoFácilapp.com"
      className="fixed z-[1000] hidden h-[60px] w-[60px] items-center justify-center rounded-full bg-[#24A1DE] text-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out hover:scale-110 hover:bg-[#2090c7] sm:flex"
      style={{
        bottom: "calc(16px + var(--safe-bottom))",
        right: "calc(16px + var(--safe-right))",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 sm:h-7 sm:w-7"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.287 5.906c-.778.324-2.334.994-4.666 2.01-.378.15-.577.298-.595.442-.03.243.275.339.69.47l1.75.55c.392.123.845.023 1.136-.26l2.132-2.062c.168-.163.342-.056.246.075l-1.74 1.63c-.237.222-.284.542-.107.755l1.642 1.972c.288.347.79.432 1.177.197l2.25-1.383c.485-.298.796-.867.72-1.442-.078-.598-.62-1.127-1.428-1.447l-5.06-2.11z" />
      </svg>
    </a>
  );
}
