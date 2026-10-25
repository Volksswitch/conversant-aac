// How-to video 1.4, on an Android device: choosing a data folder, and backups.
//
// PICTURES: Ken's screenshots from an Android tablet (1280 x 800). The account
// line in the folder picker is blurred.

const P = 'hand-captured screenshots/Android/';
const ACCOUNT = [20, 186, 700, 30];   // "Files from Drive / <email>"

export default {
  id: '1.4-safe-android',
  title: 'Keeping Your Information Safe',
  pictures: true,
  trouble: [
    "Android asks about the folder every time Conversant opens. That's normal on Android; tap Allow.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '10.png', ring: [198, 292, 530, 72],
      say: "Conversant keeps what it saves, like your About Me answers, your buttons and your conversations, in a folder you choose. In Settings, General, open Data Folder." },
    { speaker: 'narrator', image: P + '11.png', ring: [580, 282, 144, 78],
      say: "Tap Choose Folder." },
    { speaker: 'narrator', image: P + '12.png', ring: [426, 540, 170, 70],
      page: 'In Settings, General, Data Folder, tap Choose Folder. Read the note, then tap Choose a folder.',
      say: "Read this first. Your conversations go in this folder, so a folder that's backed up online gets copied online too. Then tap Choose a folder." },
    { speaker: 'narrator', image: P + '13.png', ring: [1084, 44, 56, 44], blur: [ACCOUNT],
      say: "Make a new folder for Conversant with this button, and open it." },
    { speaker: 'narrator', image: P + '13.png', ring: [18, 676, 1244, 46], blur: [ACCOUNT],
      page: 'Make a new folder, open it, and tap Use this folder.',
      say: "Then tap Use this folder." },
    { speaker: 'narrator', image: P + '14.png', ring: [870, 436, 70, 42], blur: [ACCOUNT],
      say: "Allow Chrome to use it." },
    { speaker: 'narrator', image: P + '15.png', ring: [846, 448, 70, 50],
      page: 'Allow Chrome to use the folder, and allow Conversant to edit files in it.',
      say: "Then allow Conversant to edit the files in it." },
    { speaker: 'narrator', image: P + '17.png', ring: [210, 284, 364, 72],
      page: "The folder's name shows here. Android asks again each time Conversant opens; tap Allow.",
      say: "The folder's name now shows here. Android asks about the folder again each time Conversant opens. When it does, tap Allow." },
    { speaker: 'narrator', image: P + '18.png', ring: [452, 532, 156, 84],
      page: 'To make a backup, open Settings backup, tap Backup settings, then Back up now.',
      say: "To make a backup, open Settings backup and tap Backup settings. Then tap Back up now." },
    { speaker: 'narrator', image: P + '20.png', ring: [514, 622, 80, 80],
      say: "The backup is saved in your data folder. Tap Done." },
    { speaker: 'narrator', image: P + '21.png', ring: [228, 554, 498, 72],
      page: 'Your backups are listed here. Copy one somewhere else now and then.',
      say: "Your backups are listed here, ready to restore if you ever need to. Now and then, copy one somewhere else too, in case something happens to this device. {next}" },
  ],
};
