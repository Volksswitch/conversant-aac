// How-to video 1.2, on a computer: installing Conversant.
//
// PICTURES: real screenshots of Chrome on a computer (screenshot-samples, made by
// capture-computer-samples.mjs). Rings are in each picture's own pixels.

const P = 'screenshot-samples/';

export default {
  id: '1.2-install-computer',
  title: 'Installing Conversant',
  pictures: true,
  trouble: [
    "No Install button? Make sure you're using Chrome or Edge, and that the page has finished loading.",
  ],
  steps: [
    { speaker: 'narrator', image: P + '1.2-computer-01-site-open.png', ring: [1135, 52, 75, 28],
      page: 'Open conversant.volksswitch.org in Chrome or Edge, and click Install.',
      say: "On a computer, open Chrome or Edge, and go to conversant dot volksswitch dot org. Then click this button to install Conversant as an app." },
    { speaker: 'narrator', image: P + '1.2-computer-03-install-box.png', ring: [758, 232, 60, 30],
      page: 'Your browser asks whether to install it. Click Install.',
      say: "Your browser asks whether to install it. Click Install." },
    { speaker: 'narrator', image: P + '1.2-computer-04-own-window.png',
      page: 'Conversant opens in its own window. From now on, open it from the Start menu.',
      say: "Conversant opens in its own window, without the browser's address bar, so it has more of the screen. From now on, open it from the Start menu, like any other app. {next}" },
  ],
};
