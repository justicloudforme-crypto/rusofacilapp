"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "default" | "success" | "danger";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = createContext<{ show: (message: string, variant?: ToastVariant) => void } | null>(null);

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
};

const AUTO_DISMISS_MS = 3200;

// Portal-mount detection without setState-in-effect (flagged by the
// react-hooks/set-state-in-effect rule) — the documented useSyncExternalStore
// idiom for "is this the client" instead: no-op subscribe, true on the
// client, false during SSR so the server render and the client's first
// (pre-hydration) render agree on rendering nothing.
function subscribeNever() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/**
 * Wrap the app (or a page/subtree) once with <ToastProvider>, then call
 * useToast().show("message") from any client component underneath. Renders
 * via a portal to document.body so `fixed` positioning always resolves
 * against the viewport, not whatever transformed ancestor happens to be in
 * the tree (see MobileMenu.tsx's own comment about this exact class of bug).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);

  const show = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 pb-safe"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`animate-celebration-fade-in pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-center text-sm font-medium shadow-lg ${VARIANT_CLASSES[t.variant]}`}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
