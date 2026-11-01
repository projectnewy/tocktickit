import type { KeyboardEvent } from "react";

// Props that make a non-link element (a table row, a card) behave like one for
// everybody: mouse click, and Enter or Space from the keyboard, with a Tab
// stop so it is reachable at all (ui-spec.md §6). Key presses that bubble up
// from a control inside the row are ignored.
export function activatableProps(onActivate: () => void) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
