# Changelog — Conversant AAC

Plain-language notes of what changed in each release, for the people who use the
app. Internal engineering, test, and tooling changes are intentionally left out —
this list covers only what you can see or do differently.

The version shown here matches the one on **Settings → About**. After the app
updates itself, a "What's new" summary of these notes appears automatically.

This is the single source of truth for those in-app notes. After editing it, run
`node scripts/apply-release-notes.mjs` (or say "apply release notes" to Claude) to
regenerate the bundled notes in `app/js/whats-new.js`.

## Unreleased (next release)

## Version 0.5.62

### New features

- **See what's new after an update.** When the app updates itself to a newer version, it now shows a short "What's new" summary of the features and fixes you've just received, so you always know what changed. You can also reopen it any time from **Settings → About → "See what's new in this version"**.

## Version 0.5.61

### Improvements

- **Cleaner About Me pages.** Removed the redundant back button from the bottom of the About Me question pages; use the "‹ Back to topics" link at the top.

## Version 0.5.60

### Fixes

- **"Prefer not to say" no longer erases your answer.** Marking a question as "Prefer not to say" now keeps whatever you had already entered, hidden from the AI, and an **Undo** brings your answer back. Previously it could discard an answer you had saved.

### Improvements

- **Clearer buttons in About Me.** The button that returns to the topic list is now labeled **"‹ Back to topics"**, so it's no longer confused with the **Done** button that closes About Me.
- **Simpler setting names.** "Minimum gap" is now **Minimum spacing**, "Optional Responses silence period" is now **Silence period**, and the two "Placeholder Statement Delay" settings are now **Initial placeholder delay** and **Subsequent placeholder delay**.

## Version 0.5.59

### New features

- **"Don't save this conversation."** A new button on the command bar lets you keep the current conversation from being written to your data folder — useful for a private exchange you don't want stored. You can also set this as the default for every conversation in **Settings → Conversation**.
- **Adjust text sizes.** A new **Text Size** tab in Settings lets you set the size of the response cards, the transcript, the "In my own words" box, and the Express Panel buttons independently.

### Improvements

- **Placeholders no longer talk over a returning partner.** If the other person pauses and then keeps speaking, any "still thinking" placeholder that was about to play is now cancelled so it doesn't speak over them.
