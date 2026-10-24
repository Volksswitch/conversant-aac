// How-to video 5.2: backups and moving to a new device.
//
// STAGED: the real backup controls, shown without saving a file.

import { settingsTab, section } from '../helpers.mjs';

export default {
  id: '5.2-backups',
  title: 'Backups and Moving to a New Device',
  trouble: [
    "On an iPad, the backup goes to the Files app, usually Downloads. Keep a copy somewhere else too, such as iCloud Drive.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Everything you've set up in Conversant can be saved in one backup file. It protects your work, and it's how you move to a new device." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('general'), press: true,
      say: "General," },
    { speaker: 'narrator', highlight: section('Settings backup'), press: true,
      say: "and Settings backup." },
    { speaker: 'narrator', waitFor: '#exportDataBtn', highlight: '#exportDataBtn',
      page: "In Settings, General, Settings backup, tap Backup settings to save everything in one file.",
      say: "Backup settings saves everything in one file: About Me, your people and places, your Express Panel buttons, your saved conversations, and your settings. Your keys are left out, for your safety." },
    { speaker: 'narrator',
      page: "Keep the file somewhere safe, away from the device.",
      say: "Keep the file somewhere safe, away from the device, so a lost or broken device doesn't take it with it." },
    { speaker: 'narrator', highlight: '#importDataBtn',
      page: "On a new device, tap Import and choose the file. Then add your keys again.",
      say: "On a new device, open Conversant, tap Import, and choose the file. Everything comes back. Settings that only suit the old device's screen are left as they are. Then add your keys again." },
    { speaker: 'narrator',
      say: "Make a backup after any big change, and every so often. {next}" },
  ],
};
