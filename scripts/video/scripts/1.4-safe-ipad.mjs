// How-to video 1.4, on an iPad: making a backup and keeping it somewhere safe.
//
// PICTURES: Ken's screenshots from an iPad (2360 x 1640).

const P = 'hand-captured screenshots/iPad/';

export default {
  id: '1.4-safe-ipad',
  title: 'Keeping Your Information Safe',
  pictures: true,
  trouble: [
    "Moving from Safari to the installed app? Make a backup in Safari, then use Import settings in the app.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '07.PNG', ring: [292, 732, 2048, 104],
      page: 'In Settings, General, open Settings backup.',
      say: "On an iPad, Conversant keeps what it saves inside the app, where you can't see it or copy it. So make a backup now and then. In Settings, General, open Settings backup." },
    { speaker: 'narrator', image: P + '08.PNG', ring: [1268, 828, 240, 112],
      page: 'Tap Backup settings, then Back up now.',
      say: "Tap Backup settings, then Back up now." },
    { speaker: 'narrator', image: P + '09.PNG', ring: [2068, 68, 80, 80],
      page: 'Use the Share button to save the backup file to Files, or send it somewhere else.',
      say: "Your iPad shows the backup file. Use the Share button to save it to Files, or send it somewhere else, so it isn't kept only on this iPad." },
    { speaker: 'narrator', image: P + '10.PNG', ring: [1372, 952, 136, 112],
      page: 'Conversant lists what the backup holds. Tap Done.',
      say: "Conversant lists what the backup holds. Tap Done." },
    { speaker: 'narrator', image: P + '11.PNG', ring: [632, 760, 276, 104],
      page: 'To bring a backup back, use Import settings.',
      say: "To bring a backup back, for example on a new iPad, use Import settings. {next}" },
  ],
};
