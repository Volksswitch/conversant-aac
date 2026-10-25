// How-to video 1.2, on an iPad: installing Conversant on the Home Screen.
//
// PICTURES: Ken's screenshots from an iPad (Safari), retaken October 25 2026.
// Rings are in the pictures' own pixels (2360 x 1640).

const P = 'hand-captured screenshots/iPad/';

export default {
  id: '1.2-install-ipad',
  title: 'Installing Conversant',
  pictures: true,
  trouble: [
    "No Add to Home Screen? Tap View More at the end of the Share menu to see the whole list.",
    "Already using Conversant in Safari? Make a backup there first, and bring it into the installed app. The two don't share what they've saved.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '01.PNG', ring: [950, 170, 460, 76],
      page: 'Open conversant.volksswitch.org in Safari.',
      say: "On an iPad, open Safari and go to conversant dot volksswitch dot org. We recommend installing Conversant on your Home Screen. Safari can clear a website's saved information after a week without use, and an installed app keeps it." },
    { speaker: 'narrator', image: P + '01.PNG', ring: [2030, 160, 88, 92],
      page: 'Tap the Share button.',
      say: "Tap the Share button." },
    { speaker: 'narrator', image: P + '01a.PNG', ring: [2136, 740, 132, 192],
      page: 'Tap View More to see the whole list.',
      say: "Tap View More to see the whole list." },
    { speaker: 'narrator', image: P + '03.PNG', ring: [1612, 1040, 676, 96],
      page: 'Tap Add to Home Screen.',
      say: "Tap Add to Home Screen." },
    { speaker: 'narrator', image: P + '04.PNG', ring: [1612, 200, 128, 84],
      page: 'Leave Open as Web App switched on, and tap Add.',
      say: "Leave Open as Web App switched on, and tap Add." },
    { speaker: 'narrator', image: P + '05.PNG', ring: [282, 144, 156, 186],
      page: "Conversant's icon is on your Home Screen. Open it from there from now on.",
      say: "Conversant's icon is now on your Home Screen. Open it from there from now on." },
    { speaker: 'narrator', image: P + '05a.PNG',
      say: "It fills the screen, without Safari's address bar. {next}" },
  ],
};
