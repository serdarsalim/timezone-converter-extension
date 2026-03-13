# Asr World Clock

`Asr World Clock` is a Chrome extension for checking other cities fast, comparing times inline, and quickly sending the current selection to Google Calendar.

It is built to feel direct:
- click a city name to change it
- click a time to compare against a different hour
- drag cities to reorder them
- click `+` to add another city
- use settings for `12h / 24h`, dark mode, pinning, and side panel behavior

## What It Does

- Shows multiple cities at once in a clean list
- Lets you edit a city name without opening a settings page
- Lets you change the time in one row and instantly see that same moment in every other row
- Lets you add a Google Calendar event from the current selected time
- Supports both popup mode and Chrome side panel mode
- Saves your cities and preferences locally

## How To Install

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Choose this folder:
   `/Users/slm/my-portfolio/timezone-extension`

After that, pin the extension to your Chrome toolbar if you want faster access.

## How To Use

### Edit a city

Click the city name.

Start typing and a list of matching cities and time zones will appear. Pick one from the list or finish typing your preferred label.

### Compare a different time

Click the time in any row.

You can:
- type the hour or minute
- use the mouse wheel on the hour field
- use the mouse wheel on the minute field

When you change one row, all other rows update to show that same moment in their own local time.

To go back to the real current time, use `Use current time` at the top.

### Reorder cities

Drag a row from the empty middle area of the card.

If `Pin first timezone` is turned on, the first row stays fixed at the top.

### Add a city

Click `+` below the list, then start typing.

### Remove a city

Click into the city name, then use `Remove city`.

### Calendar view

Click the calendar button in the top left.

From there you can:
- choose a date
- choose a time
- choose a duration
- optionally enter an event name
- open a prefilled Google Calendar event

## Settings

Open settings from the top right.

Available settings:
- `12h / 24h`
- `Pin first timezone`
- `Open in side panel`
- `Dark mode`

If you turn on `Open in side panel` while using the popup, the popup closes and the extension opens in the side panel immediately.

## Privacy

`Asr World Clock` stores your cities and preferences locally in Chrome storage.

It does not require an account.

## License

`Asr World Clock` is licensed under the GNU Affero General Public License v3.0.

See [`LICENSE`](/Users/slm/my-portfolio/timezone-extension/LICENSE) for the full text.

## Notes

- The sun icon means it is daytime in that city.
- The moon icon means it is dark there.
- The pinned first timezone shows a pin next to the city name.
