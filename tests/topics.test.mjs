/* My Topics (app/js/topics.js): the subjects the user takes questions on. */
import { resetLocalStorage } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as topics from '../app/js/topics.js';

beforeEach(async () => { resetLocalStorage(); await topics.load(); });

test('a topic survives a reload, with its documents and note', async () => {
    const id = await topics.addTopic({ name: ' Conversant AAC ', sources: ['src-a', 'src-b', 'src-a'],
        note: ' I lead the project. ' });
    await topics.load();   // read back the STORED copy: the whitelist trap bites here
    assert.deepEqual(topics.getTopic(id), { id, name: 'Conversant AAC', pronunciation: '',
        sources: ['src-a', 'src-b'], note: 'I lead the project.' });
});

test('the note is limited where it enters', async () => {
    const id = await topics.addTopic({ name: 'T', note: 'x'.repeat(5000) });
    assert.equal(topics.getTopic(id).note.length, topics.NOTE_MAX);
});

test('an update keeps what it was not given, and an emptied name keeps the old one', async () => {
    const id = await topics.addTopic({ name: 'Keyguards', sources: ['s1'], note: 'n' });
    await topics.updateTopic(id, { name: '  ', note: 'new note' });
    assert.deepEqual(topics.getTopic(id), { id, name: 'Keyguards', pronunciation: '', sources: ['s1'], note: 'new note' });
});

test('a deleted document is forgotten by every topic, and removing a topic removes it', async () => {
    const a = await topics.addTopic({ name: 'A', sources: ['s1', 's2'] });
    const b = await topics.addTopic({ name: 'B', sources: ['s2'] });
    await topics.forgetSource('s2');
    await topics.load();
    assert.deepEqual(topics.getTopic(a).sources, ['s1']);
    assert.deepEqual(topics.getTopic(b).sources, []);
    await topics.removeTopic(a);
    assert.equal(topics.getTopic(a), null);
    assert.equal(topics.count(), 1);
});
