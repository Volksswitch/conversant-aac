// How-to video 1.2, on an iPad: installing Conversant on the Home Screen.
//
// PICTURES: Ken's screenshots from an iPad (Safari). Rings are in the pictures'
// own pixels (2360 x 1640).

const P = 'hand-captured screenshots/iPad/';

export default {
  id: '1.2-install-ipad',
  title: 'Installing Conversant',
  pictures: true,
  trouble: [
    "No Add to Home Screen? Tap View More at the bottom of the Share menu to see the whole list.",
    "Already using Conversant in Safari? Make a backup there first, and bring it into the installed app. The two don't share what they've saved.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '01.PNG', ring: [940, 60, 480, 90],
      page: 'Open conversant.volksswitch.org in Safari.',
      say: "On an iPad, open Safari and go to conversant dot volksswitch dot org. We recommend installing Conversant on your Home Screen. Safari can clear a website's saved information after a week without use, and an installed app keeps it." },
    { speaker: 'narrator', image: P + '02.PNG', ring: [2085, 62, 72, 76],
      page: 'Tap the Share button.',
      say: "Tap the Share button." },
    { speaker: 'narrator', image: P + '03.PNG', ring: [2130, 680, 146, 180],
      page: 'Tap View More, then Add to Home Screen.',
      say: "Tap View More, then Add to Home Screen." },
    { speaker: 'narrator', image: P + '04.PNG', ring: [1608, 124, 136, 96],
      page: 'Leave Open as Web App switched on, and tap Add.',
      say: "Leave Open as Web App switched on, and tap Add." },
    { speaker: 'narrator', image: P + '05.PNG', ring: [1264, 148, 160, 180],
      page: "Conversant's icon is on your Home Screen. Open it from there from now on.",
      say: "Conversant's icon is now on your Home Screen. Open it from there from now on." },
    { speaker: 'narrator', image: P + '06.PNG',
      say: "It fills the screen, without Safari's address bar. {next}" },
  ],
};
