// How-to video 1.2, on an Android device: installing Conversant.
//
// PICTURES: Ken's screenshots from an Android tablet (Chrome). Rings are in the
// pictures' own pixels (1280 x 800).

const P = 'hand-captured screenshots/Android/';

export default {
  id: '1.2-install-android',
  title: 'Installing Conversant',
  pictures: true,
  trouble: [
    "Can't find Install and create shortcut? Scroll down in Chrome's menu. On some devices it's called Install app or Add to Home screen.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '01.png', ring: [1222, 100, 44, 44],
      page: 'Open conversant.volksswitch.org in Chrome, and tap the menu button.',
      say: "On an Android device, open Chrome and go to conversant dot volksswitch dot org. Then tap Chrome's menu button." },
    { speaker: 'narrator', image: P + '03.png', ring: [890, 410, 370, 46],
      page: 'Scroll down, and tap Install and create shortcut.',
      say: "Scroll down the menu, and tap Install and create shortcut." },
    { speaker: 'narrator', image: P + '04.png', ring: [278, 530, 730, 66],
      page: 'Choose Install, not Create shortcut.',
      say: "Choose Install. A shortcut would open Conversant inside Chrome instead." },
    { speaker: 'narrator', image: P + '05.png', ring: [840, 512, 80, 50],
      page: 'Tap Install.',
      say: "Then tap Install." },
    { speaker: 'narrator', image: P + '06.png', ring: [660, 40, 560, 100],
      say: "Android tells you when it's installed." },
    { speaker: 'narrator', image: P + '07.png', ring: [56, 30, 120, 160],
      page: "Open Conversant from its icon on your home screen from now on.",
      say: "Conversant's icon is now on your home screen. Open it from there from now on." },
    { speaker: 'narrator', image: P + '08.png',
      say: "It opens on its own, without Chrome's address bar, so it has more of the screen. {next}" },
  ],
};
