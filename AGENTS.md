# AGENTS.md

## Project

This repo contains `Asr World Clock`, a minimalist Chrome extension for comparing time zones from a popup UI.

## Product rules

- Keep the UI minimalist and direct.
- Do not add logos, branding blocks, or decorative header content.
- Do not add analog clocks.
- Do not add motion effects, hover lift, or transition-heavy UI.
- Do not reintroduce country labels in the main card layout.
- Do not add a normal settings page for core actions.

## Interaction rules

- City names must be editable inline from the main popup.
- Time values must be editable inline from the main popup.
- Editing the time in one row sets a global comparison reference for all rows.
- Only the active comparison source should show `Reset`.
- Reordering should happen directly in the list without visible drag handles.
- Adding a city should happen from the header `+` control, not from a separate settings flow.
- The time format toggle lives behind the header settings control and only switches `12h` / `24h`.

## Visual rules

- Prefer Apple-style system typography on macOS.
- Keep the interface quiet and typography-led.
- Use sun and moon symbols only as lightweight status indicators.
- Do not show background pills behind the sun or moon icons.
- Keep icons simple and slightly larger rather than badge-like.

## Technical notes

- This is a Chrome Manifest V3 extension.
- Persist user state with `chrome.storage.local`.
- Keep the popup usable without any build step.
- Favor small direct edits over introducing frameworks or tooling unless explicitly requested.

## Files

- `manifest.json`: extension manifest
- `popup.html`: popup structure
- `popup.css`: popup styling
- `popup.js`: popup state and interactions
