// Not a test: prints how the result of problem 7 depends on how much a quiet voice
// varies. Run: node tests/pending/2026-11-13-ipad-listening/7-voice-variation.mjs
import { url } from './harness.mjs';
const { createGate } = await import(url('app/js/vad.js'));
// A quiet voice peaking at 0.008, with its quieter frames at 'soft'. Frames 85 ms.
function openAt(soft, roomFirst) {
  const peak = 0.008;
  const pattern = [peak, soft, peak*0.8, soft*1.5, peak*0.9, soft, peak*0.7, soft*2, peak, soft*1.2, peak*0.6, soft];
  const g = createGate(); let t = 0;
  const levels = [...(roomFirst ? Array(14).fill(0.0004) : []), ...Array.from({length: 120}, (_, i) => pattern[i % pattern.length])];
  for (const l of levels) { if (g.push(l, t) === 'open') return (t/1000).toFixed(1) + ' s'; t += 85; }
  return 'not in 10 s (bar ' + g.levels().open.toFixed(4) + ')';
}
for (const soft of [0.004, 0.003, 0.002, 0.0015, 0.001]) {
  console.log(`softest frames ${soft} (loudest ${(0.008/soft).toFixed(1)}x louder): talking first -> ${openAt(soft,false)};  room first -> ${openAt(soft,true)}`);
}
