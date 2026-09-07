import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour for a popover menu opened from a trigger button:
 *
 * - when the menu opens, focus moves to its first focusable item;
 * - Escape closes it;
 * - when it closes, focus returns to the trigger.
 *
 * Attach `triggerRef` to the button that opens the menu and `menuRef` to the
 * menu container. Pointer dismissal (backdrop click) stays in the component.
 */
export function useDismissableMenu(open: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  // Keep the latest onClose without re-running the effect when its identity changes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      menuRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCloseRef.current();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
    return undefined;
  }, [open]);

  return { triggerRef, menuRef };
}
