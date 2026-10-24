# Existing interface contract

This documents the incumbent implementation in `apps/workspaces/src/styles.css`, `apps/web-public/src/styles/global.css`, `apps/mobile/App.tsx` and `packages/ui`. It preserves an established interface; it is not a newly approved rebrand.

## Typography and color

- Web type: `system-ui, sans-serif`; use the bundled Noto Sans Malayalam and Noto Sans Tamil resources for their languages. Native uses system text and the same bundled language fonts.
- Primary text/action: `#163d36`; secondary text: `#415d55`.
- Page background: `#f5f4ec`; input/panel background: white.
- Control border: `#647c70`; panel border: `#c7d2ca` or existing public `#d1d9d2`.
- Focus: `#855b11`, 3px outline with 4px offset. Disabled controls use `#dee4df` and `#415d55`.
- Do not introduce new brand colors, decorative gradients, unapproved imagery or medical claims.

## Layout and components

- Preserve workspace width 1050px and public width 1152px, centered with 32px desktop and 24px small-screen padding.
- Follow the existing 8px-family spacing, 12–24px control/section gaps and 32px section rhythm.
- Existing control corners are 8px; panels are 10–12px. Keep data tables and forms visually quieter than primary actions.
- Use existing shared Button, Notice, Field, LanguageSelect and session/transport contracts before adding a separate component family.
- Root navigation and shared application registration are coordinator-owned during parallel work. Customer, staff and knowledge views use scoped modules.
- Reflow to a single column around the existing 650–700px breakpoints; no horizontal page overflow. Wide tables need a labeled local scrolling container.

## Interaction and accessibility

- Preserve skip navigation, semantic landmarks/headings, visible labels, keyboard reachability, focus visibility and minimum 44px control targets.
- Clearly distinguish loading, empty, unauthenticated, denied, unavailable, pending, conflict, failed and confirmed states.
- Only authoritative server/provider state establishes a business success. Confirmation must display current relevant details and cannot be inferred from browser return, fixture state or UI disabling.
- Keep permission enforcement on the server; clear sensitive client data on session loss and avoid private response caching.
- New operational labels belong in shared locale resources. Medical wording requires named approval; a translated UI is not clinical approval.
- No decorative motion is needed. Respect reduced motion for any functional transition; keep content visible without animation.

## Verification

Inspect rendered desktop and mobile widths together, including keyboard navigation, errors, pending integrations and successful test-fixture journeys. Capture actual screenshots, fix material defects in a bounded batch, then confirm once. Native JavaScript exports and browser mobile widths are not signed real-device proof. Independent review and the recorded G1 decision remain separate requirements.
