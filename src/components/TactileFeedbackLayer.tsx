import React, { useEffect, useRef } from 'react';
import { playTactileFeedback, TactileSoundKind } from '../utils/tactileAudio';

const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], .cursor-pointer, .interactive-spring, .sf-card-interactive, .sf-teacher-kpi, .sf-teacher-tile, .sf-timetable-slot, .reaction-pill';

export const TactileFeedbackLayer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionRef.current = mq.matches;
      const listener = (e: MediaQueryListEvent) => {
        reducedMotionRef.current = e.matches;
      };
      mq.addEventListener?.('change', listener);
      return () => mq.removeEventListener?.('change', listener);
    }
  }, []);

  useEffect(() => {
    const resolveSoundKind = (interactiveEl: HTMLElement): TactileSoundKind => {
      const explicitSound = interactiveEl.getAttribute('data-sound') as TactileSoundKind | null;
      if (explicitSound) return explicitSound;
      if (interactiveEl.closest('nav') || interactiveEl.closest('[data-nav-dock="true"]')) {
        return 'nav';
      }
      if (interactiveEl.getAttribute('role') === 'switch' || interactiveEl.getAttribute('aria-pressed') !== null) {
        return 'toggle';
      }
      return 'tap';
    };

    const spawnRipple = (x: number, y: number, kind: TactileSoundKind) => {
      const container = containerRef.current;
      if (!container || reducedMotionRef.current || x <= 0 || y <= 0) return;
      if (container.childElementCount > 6) {
        container.firstElementChild?.remove();
      }
      const span = document.createElement('span');
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      const variant =
        kind === 'success'
          ? 'sf-tactile-ripple-emerald'
          : kind === 'nav'
          ? 'sf-tactile-ripple-indigo'
          : 'sf-tactile-ripple-cyan';
      span.className = `sf-tactile-ripple ${variant}`;
      container.appendChild(span);
      window.setTimeout(() => {
        span.remove();
      }, 380);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactiveEl = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactiveEl || (interactiveEl as HTMLButtonElement).disabled) return;

      const kind = resolveSoundKind(interactiveEl);
      playTactileFeedback(kind);
      spawnRipple(e.clientX, e.clientY, kind);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const interactiveEl = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactiveEl || (interactiveEl as HTMLButtonElement).disabled) return;

      const kind = resolveSoundKind(interactiveEl);
      playTactileFeedback(kind);
      const rect = interactiveEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        spawnRipple(rect.left + rect.width / 2, rect.top + rect.height / 2, kind);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
    />
  );
};
