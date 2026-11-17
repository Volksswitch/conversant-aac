// How-to video 1.2, on an iPad: installing Conversant on the Home Screen.
//
// PICTURES: Ken's screenshots from an iPad (Safari). The share-menu pictures were
// taken October 25 2026; the microphone pictures (IMG_0082-0087) November 15 2026.
// Rings are in the pictures' own pixels (2360 x 1640).
//
// The microphone is allowed in Safari's Website Settings BEFORE the app is added to
// the Home Screen, and Start is never tapped in Safari (Ken, November 17 2026): the
// installed app keeps a permission given beforehand, and does not see one given after.

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
    { speaker: 'narrator', image: P + 'IMG_0082.PNG', ring: [802, 62, 753, 92],
      page: "Open conversant.volksswitch.org in Safari. Don't tap Start yet.",
      say: "On an iPad, open Safari and go to conversant dot volksswitch dot org. We recommend installing Conversant on your Home Screen. Safari can clear a website's saved information after a week without use, and an installed app keeps it. Don't tap Start yet." },
    { speaker: 'narrator', image: P + 'IMG_0082.PNG', ring: [800, 62, 95, 95],
      page: 'Tap the page settings button at the left of the address bar, then the More button (three dots).',
      say: "First, let Conversant use the microphone. Tap the page settings button at the left of the address bar." },
    { speaker: 'narrator', image: P + 'IMG_0083.PNG', ring: [1135, 197, 105, 105],
      say: "Tap the More button." },
    { speaker: 'narrator', image: P + 'IMG_0084.PNG',
      say: "Scroll down to Website Settings." },
    { speaker: 'narrator', image: P + 'IMG_0085.PNG', ring: [645, 1222, 1078, 100],
      say: "Tap Microphone." },
    { speaker: 'narrator', image: P + 'IMG_0086.PNG', ring: [1274, 1137, 425, 72],
      page: 'Scroll down to Website Settings, tap Microphone, choose Allow, and close the menu.',
      say: "Choose Allow." },
    { speaker: 'narrator', image: P + 'IMG_0087.PNG', ring: [615, 197, 96, 96],
      say: "Microphone now says Allow. The installed app keeps this, so it won't need to ask. Close the menu." },
    { speaker: 'narrator', image: P + 'IMG_0082.PNG', ring: [2070, 60, 100, 100],
      page: 'Tap the Share button.',
      say: "Now tap the Share button." },
    { speaker: 'narrator', image: P + '01a.PNG', ring: [2136, 740, 132, 192],
      say: "Tap View More to see the whole list." },
    { speaker: 'narrator', image: P + '03.PNG', ring: [1612, 1040, 676, 96],
      page: 'Tap Add to Home Screen, leave Open as Web App switched on, and tap Add.',
      say: "Tap Add to Home Screen." },
    { speaker: 'narrator', image: P + '04.PNG', ring: [1612, 200, 128, 84],
      say: "Leave Open as Web App switched on, and tap Add." },
    { speaker: 'narrator', image: P + '05.PNG', ring: [282, 144, 156, 186],
      page: "Conversant's icon is on your Home Screen. Open it from there from now on, and tap Start.",
      say: "Conversant's icon is now on your Home Screen. Open it from there from now on, and tap Start." },
    { speaker: 'narrator', image: P + '05a.PNG',
      say: "It fills the screen, without Safari's address bar. {next}" },
  ],
};
