// How-to video 1.4, on a computer: choosing a data folder, and backups.
//
// PICTURES: real screenshots of Chrome on a computer (screenshot-samples). The
// folder picker is blurred, because it showed the computer's own folder names.

const P = 'screenshot-samples/';

export default {
  id: '1.4-safe-computer',
  title: 'Keeping Your Information Safe',
  pictures: true,
  trouble: [
    "Conversant asks for the folder again? Choose the same folder. Your information is still in it.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '1.4-computer-00-choose-folder-button.png', ring: [1214, 345, 128, 52],
      page: 'In Settings, General, Data Folder, click Choose Folder.',
      say: "Conversant keeps what it saves, like your About Me answers, your buttons and your conversations, in a folder you choose. In Settings, General, open Data Folder, and click Choose Folder." },
    { speaker: 'narrator', image: P + '1.4-computer-01-before-you-choose.png', ring: [722, 484, 162, 64],
      page: 'Read the note, then click Choose a folder.',
      say: "Read this first. Your conversations go in this folder, so if the folder is in OneDrive, they're copied online too. Then click Choose a folder." },
    { speaker: 'narrator', image: P + '1.4-computer-02-folder-picker.png',
      page: 'Make a new folder, select it, and let Conversant use it.',
      say: "Make a new folder, for example Conversant data, select it, and confirm. When your browser asks, let Conversant use the folder." },
    { speaker: 'narrator', image: P + '1.4-computer-00-choose-folder-button.png', ring: [170, 483, 1160, 58],
      page: 'Settings backup saves a backup file in that folder. Copy it somewhere else now and then.',
      say: "Once you have a folder, Settings backup puts a backup file in it. Now and then, copy that file somewhere else too, like a USB stick, in case something happens to this computer. {next}" },
  ],
};
