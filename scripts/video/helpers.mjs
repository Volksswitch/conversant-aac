// Small helpers the video scripts share.

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// The response options, by position.
export const card = (n) => `#responseOptions > .response-cell:nth-child(${n})`;

// Some words, anywhere in the Conversation Pane. A line still being said sits
// outside the log, so the log alone is not enough.
// Quoted, because words can carry commas, which would otherwise split the selector.
export const onScreen = (text) => `#transcriptSection ::-p-text(${JSON.stringify(text)})`;

// Some words on one of the response options.
export const cardSays = (n, text) => `${card(n)} ::-p-text(${JSON.stringify(text)})`;

// The partner speaks, through the stand-in microphone.
//
// ⚠ The wait first is not padding. While the app is speaking, and for a moment
// after, it ignores what the microphone hears, so its own voice is never taken
// for the partner's. A partner line delivered inside that window would be
// thrown away, exactly as it would be in a real room.
export async function hear(page, text) {
  await page.waitForFunction(() => !window.__speakingNow, { timeout: 10000 });
  await pause(1800);
  await page.waitForFunction(() => window.__videoMic.isOn(), { timeout: 8000 })
    .catch(() => { throw new Error('STOPPING - the partner spoke, but the microphone was off'); });
  await page.evaluate((t) => window.__videoMic.hear(t), text);
}

// Wait until the app has finished what it was doing and Listen is off, so a tap
// on Listen turns it on rather than catching it mid-change and turning it off.
export const untilListenOff = (page) => page.waitForFunction(() =>
  !document.getElementById('listenBtn').classList.contains('listening'), { timeout: 10000 })
  .then(() => pause(800));

// What the app said aloud most recently, in the user's voice. Used where the
// app chooses the words itself (a holding phrase, Hold on), so the video says
// exactly what the app said.
export const lastSpoken = (page) => page.evaluate(() => window.__spoken.at(-1) || '');

// Wait until the app has said `count` things since the page opened.
export async function untilSpoken(page, count, timeout = 15000) {
  await page.waitForFunction((n) => window.__spoken.length >= n, { timeout }, count);
}

// Note how much the app has said so far, so a later step can wait for the next
// thing it says (markSpoken in one step's `before`, untilNewSpeech in the next).
export const markSpoken = (page) => page.evaluate(() => { window.__spokenMark = window.__spoken.length; });
export const untilNewSpeech = (page, timeout = 15000) =>
  page.waitForFunction(() => window.__spoken.length > (window.__spokenMark ?? 0), { timeout });

// Type into a text box the way a person would.
export async function typeInto(page, selector, text) {
  await page.click(selector);
  await page.type(selector, text, { delay: 20 });
}

// The button that opens "In my own words".
export const ownWordsBtn = '#expressPanel button[aria-label*="own words" i]';

// A Settings section heading, found by its words. Tapping it opens the section.
export const section = (name) => `::-p-xpath(//dialog[@open]//summary[.//*[normalize-space(text())=${JSON.stringify(name)}]])`;

// A Settings tab, by its name in the code (data-tab).
export const settingsTab = (name) => `#settingsTabs .settings-tab[data-tab="${name}"]`;
