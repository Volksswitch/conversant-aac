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

// Choose an item in a drop-down list by its words, as a person would.
export async function choose(page, selector, words) {
  const h = await page.$(selector);
  if (!h) throw new Error(`STOPPING - nothing on screen matches ${selector}`);
  const ok = await h.evaluate((el, w) => {
    const o = [...el.options].find((x) => x.textContent.trim() === w);
    if (!o) return false;
    el.value = o.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, words);
  if (!ok) throw new Error(`STOPPING - the list ${selector} has no "${words}"`);
}

// An About Me topic, and things found by their words.
export const topic = (name) => `::-p-xpath(//button[contains(@class,"wv-module-row")][.//*[normalize-space(text())=${JSON.stringify(name)}]])`;
export const fieldByHint = (hint) => `::-p-xpath(//*[(self::input or self::textarea) and starts-with(@placeholder,${JSON.stringify(hint)})])`;
export const buttonText = (label) => `::-p-xpath(//dialog[@open]//button[normalize-space(text())=${JSON.stringify(label)}])`;

// Replace whatever is in a text box with new words, as a person would.
export async function replaceText(page, selector, text) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, text, { delay: 20 });
}

// An Express Panel button, by its words.
export const panelButton = (words) => `::-p-xpath(//*[@id="expressPanel"]//button[normalize-space(.)=${JSON.stringify(words)}])`;

// An Express Panel button whose label contains these words (Context buttons
// carry a small mark before the name).
export const panelButtonWith = (words) => `::-p-xpath(//*[@id="expressPanel"]//button[contains(normalize-space(.),${JSON.stringify(words)})])`;

// Hold the app's speech open, or let it finish (see the renderer's stand-in voice).
export const holdSpeech = (page, on) => page.evaluate((v) => { window.__holdSpeech = v; }, on);

// Make the newest saved conversation (in the browser's own storage) last exactly
// `seconds`, by spacing its moments proportionally between its start and its last
// moment. Its real length is however long the render took between steps, which
// varies with how busy the computer is, so the review list's "How long" column
// otherwise made video 3.10 look changed on most syncs (October 28 2026).
export async function fixConversationLength(page, seconds) {
  const problem = await page.evaluate(async (ms) => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('conversations');
    let newest = null;
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== 'file' || !name.endsWith('.json') || name.endsWith('.review.json')) continue;
      if (!newest || name > newest.name) newest = { name, h };
    }
    if (!newest) return 'there is no saved conversation to set the length of';
    const data = JSON.parse(await (await newest.h.getFile()).text());
    const start = Date.parse(data.started);
    const stamps = (data.exchanges || []).map((e) => Date.parse(e && e.timestamp)).filter(Number.isFinite);
    const last = Math.max(...stamps);
    if (!Number.isFinite(start) || !(last > start)) return 'the saved conversation has no length to set';
    const at = (iso) => new Date(start + (Date.parse(iso) - start) * (ms / (last - start))).toISOString();
    for (const e of data.exchanges) if (e && Number.isFinite(Date.parse(e.timestamp))) e.timestamp = at(e.timestamp);
    if (Number.isFinite(Date.parse(data.ended))) data.ended = at(data.ended);
    const w = await newest.h.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
    return null;
  }, seconds * 1000);
  if (problem) throw new Error(`STOPPING - ${problem}`);
}

// Drag something by a distance, as a finger would.
export async function dragBy(page, selector, dx, dy) {
  const h = await page.$(selector);
  if (!h) throw new Error(`STOPPING - nothing on screen matches ${selector}`);
  const b = await h.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}
