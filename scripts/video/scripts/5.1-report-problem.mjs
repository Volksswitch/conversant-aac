// How-to video 5.1: telling us about a problem.
//
// STAGED: the real report, built and previewed, then cancelled, so nothing is
// sent from the video. (A copy running on this computer never sends anyway.)

import { settingsTab, section, typeInto } from '../helpers.mjs';

export default {
  id: '5.1-report-problem',
  title: 'Telling Us About a Problem',
  trouble: [
    "Conversant won't start at all? Use the If something is wrong link under the Start button. It sends the same report.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "If something goes wrong, tell us from inside Conversant. The report tells us what we need to fix it." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('troubleshooting'), press: true,
      say: "then Troubleshooting," },
    { speaker: 'narrator', highlight: section('Report a problem'), press: true,
      say: "and Report a problem." },
    { speaker: 'narrator', waitFor: '#problemNoteInput', before: (p) => typeInto(p, '#problemNoteInput', 'The options stopped appearing after I tapped New 4.'),
      highlight: '#problemNoteInput',
      page: "In Settings, Troubleshooting, Report a problem, write a few words about what happened.",
      say: "Write a few words about what happened. A short note is plenty." },
    { speaker: 'narrator', highlight: '#sendProblemReportBtn', press: true,
      say: "Then tap Send." },
    { speaker: 'narrator', waitFor: '.danger-dialog[open]', highlight: '.danger-dialog[open]',
      page: "Tap Send. Conversant shows you exactly what will be sent before it goes.",
      say: "Conversant shows you exactly what will be sent, before anything goes. Your keys are never in it." },
    { speaker: 'narrator', highlight: '.danger-dialog[open] .danger-confirm',
      page: "If it looks right, tap Send it.",
      say: "If it looks right, tap Send it. Here, Marc taps Not yet, because this is only a practice." },
    { speaker: 'narrator', highlight: '.danger-dialog[open] .danger-cancel', press: true,
      say: "{next}" },
  ],
};
