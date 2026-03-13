# Times

`Times` is a minimalist Chrome extension for comparing time zones without a settings-heavy workflow.

The popup is designed around direct manipulation:
- click a city name to rename it inline
- click a time to set a comparison reference
- drag cards to reorder them
- click `+` to add another city
- use the header settings button to switch between `12h` and `24h`

## Current behavior

When you edit the time on one row, that row becomes the active reference time and every other row updates to the matching local time for the same moment. Reset clears the comparison and returns the list to live time.

The UI intentionally avoids extra chrome:
- no separate settings page for normal use
- no visible drag handles
- no motion effects
- no country labels
- only a sun icon for daylight and a moon icon for dark hours

## Features

- Chrome Manifest V3 popup extension
- Persistent local state with `chrome.storage.local`
- Inline city editing with timezone lookup
- Inline reference-time editing with global recalculation
- Reset for the active comparison source
- Drag and drop reordering
- Header `+` add flow
- Header time format toggle
- Apple-style system font stack on macOS

## Files

- `manifest.json`: extension manifest
- `icons/icon.svg`: source vector for the extension icon
- `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`: Chrome icon exports
- `popup.html`: popup markup
- `popup.css`: visual system and layout
- `popup.js`: popup state, rendering, storage, and interactions

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click `Load unpacked`
4. Select `/Users/slm/my-portfolio/timezone-extension`

## Notes

- State is stored locally in the browser.
- The current drag-and-drop implementation uses native drag events inside the popup.
- Timezone suggestions come from a small curated list plus `Intl.supportedValuesOf("timeZone")` when available.
