import type { KeyboardEvent } from 'react';

/** Apply the standard arrow-key, Home, and End interactions to a tab list. */
export function navigateTabs(event: KeyboardEvent<HTMLElement>) {
  const vertical = event.currentTarget.getAttribute('aria-orientation') === 'vertical';
  const forward = vertical ? 'ArrowDown' : 'ArrowRight';
  const backward = vertical ? 'ArrowUp' : 'ArrowLeft';
  if (![forward, backward, 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = tabs.findIndex((tab) => tab === document.activeElement);
  if (current === -1) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === forward ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
