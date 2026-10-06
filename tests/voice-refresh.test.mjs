/* CR-294. A backup restore waits for a voice update that is still running, so the old
 * voice profile is not saved over the restored one. */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const vr = await import('../app/js/voice-refresh.js');

test('whenIdle waits for the voice update in progress, and two asks share one run', async () => {
    const a = vr.refreshVoiceHarvest();
    const b = vr.refreshVoiceHarvest();
    assert.equal(a, b, 'a second ask while one is running shares it');
    assert.equal(vr.whenIdle(), a, 'whenIdle is the run in progress');
    await a;
    await vr.whenIdle();   // resolves at once when nothing is running
});
