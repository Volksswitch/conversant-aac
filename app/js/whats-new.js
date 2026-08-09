/* "What's new" post-update notice.
 *
 * Conversant auto-updates itself on launch (a redeployed sw.js activates and the
 * controllerchange handler in index.html reloads the page — see index.html). After
 * that silent update, the freshly-loaded build shows the user a short, plain-language
 * summary of what changed since the version they last saw, so an update never happens
 * invisibly. Modeled on the Keyguard Designer web app's "What's new" system.
 *
 * The notes are BUNDLED in the app (the RELEASE_NOTES map below), not fetched — so
 * the notice works even offline / on locked-down networks: the freshly-loaded app
 * already IS the new version, so it carries its own notes.
 *
 * RELEASE_NOTES is generated from the user-facing CHANGELOG.md by
 * scripts/apply-release-notes.mjs (trigger: "apply release notes"). Do NOT edit the
 * block between the @@RELEASE_NOTES markers by hand — edit CHANGELOG.md and regenerate.
 */

import * as storage from './storage.js';

// Clinician/user-facing "What's new" notes, keyed by app version string
// (major.minor.patch). Versions with no user-visible change simply have no key.
// @@RELEASE_NOTES_START@@
const RELEASE_NOTES = {
  "0.7.1": [
    "Automatic weekly reports are now switched on. About once a week, when you open the app, it sends back a short summary of how it has been going — how many conversations, how long things took, and any errors it recorded. It never includes anything you or the other person said. Put the name you were given in Settings → Troubleshooting so we know whose report it is; the same place shows exactly what a report contains, lists everything already sent, and has the switch to turn it off.",
    "Fixed: a problem report was leaving out whether the app can use this device's speech recognition — the first thing worth knowing when the app cannot hear anyone.",
    "The first time you open the app after this update, it sends a report straight away rather than waiting for the week to come round, so you and we can both see that reporting is working before you rely on it.",
    "Fixed: with a screen edge margin set, the keyboard did not move in with everything else, so its keys no longer lined up with the Express Panel buttons behind them — and a keyguard cut for one would not fit the other. The keyboard now sits inside the margin like the rest of the app.",
    "When you tap a button in the Express Panel to set it up, that button now stays highlighted while you work on it, so you can see which one you picked. The highlight moves when you tap a different button, and clears when you leave the Express Panel settings or close Settings.",
    "\"How I talk with them\" now looks like something you can open. In About Me → People I Know, when you add or edit a person, that section had no arrow and no box, so it read as a heading rather than a control — and everything inside it, including the conversation starters and goodbyes for that person, looked as though it simply wasn't there. It is now a proper button with an arrow that turns when it opens, and it says what you'll find inside.",
    "Settings → Speech now offers a silence period of 0 seconds: instead of waiting a set time, the app asks for suggestions the moment it hears the other person stop. It is the quickest setting available, and it will ask more often during a long turn, which costs a little more."
  ],
  "0.7.0": [
    "Empty Express Panel buttons now show, and you can tap one to fill it in. The panel arrives half filled on purpose, and until now the cells you hadn't used yet were simply nothing. Each one is now drawn as an empty outlined button, and tapping it takes you straight to Settings → Express Panel with that exact button ready to set up — so you choose where a button goes by tapping the spot you want it in, instead of adding it to the end of a list and moving it up. Everything stays exactly where it was on screen, so a keyguard still fits. Tapping an empty button does nothing while you're in a conversation.",
    "The Express Panel works while the Express Panel settings are open. You can tap a button in the panel to jump to its row in the list, so you're editing the panel while looking at the panel. Tapping a button there sets it up rather than speaking it.",
    "You can tell the app how to say a word it gets wrong. Names are the usual culprit — your own, a friend's, a place you go. There is now a \"how to say it\" box next to each Express Panel phrase, next to a person's name and what you call them, and next to a place, each with its own 🔊 so you can try a spelling and hear the result straight away. Spelling it the way it sounds is what works: \"Shiv-awn\" for Siobhan. Only the voice sees it. The button, the person, the place and the conversation transcript all keep the real spelling — so nothing on screen changes, and a saved conversation still reads properly.",
    "The good voice no longer drops out for a single sentence. If you pay for the Deepgram voice, it used to fall back to your device's own voice whenever the connection to the voice service had quietly closed — usually after a quiet stretch in a conversation — which came out as one odd-sounding sentence and then back to normal. The app now keeps that connection alive between sentences, and tries once more before falling back. When it does still fall back, the conversation record now shows which sentence it was.",
    "Every phrase in the Express Panel settings has a 🔊 button to hear it. It reads the phrase aloud in your own voice, exactly as it will sound when you tap that button in a conversation — because a phrase can look right on screen and land wrong when it's spoken. The same idea as \"Speak my answer\" in About Me.",
    "The app no longer answers general-knowledge questions for you. If someone asks you something like a date, a figure, a definition or how something works, the app used to hand over the answer out of its own knowledge — which quietly turned you into a search engine other people could look things up in, and put words in your mouth that you might not actually have known. It now offers what a person offers: saying you don't know, turning the question back, or giving what you do have. If you do know the answer, type it into \"In my own words\" and tap Reframe — what you type is always treated as true, and the suggestions are built around it.",
    "You can tell the app which subjects you genuinely know well. About Me → Passions & Hobbies has a new question: \"What do you know a lot about?\" Anything you list there, the app will answer on properly and in detail, because you have said it is yours. Everything outside your list stays off limits.",
    "Answers are shorter and less lecture-like. Even when the app does answer, it now says the thing you were asked and stops, instead of adding background you didn't ask for.",
    "New About Me section: \"Humor & Playfulness\". Three questions — what your sense of humor is like, whether you enjoy back-and-forth teasing, and whether the app should ever offer you a cheeky or joking response. Nobody gets a joking suggestion unless they have asked for one, and if you say no, every suggestion stays straight. Even when you say yes, only one of the four suggestions on a turn is ever the light one, so there is always a plain way to say the same thing — and never on a serious, upsetting or medical turn.",
    "Three more About Me sections finish the personal half of the questionnaire. \"Beliefs & Convictions\" — faith, outlook, and whether you hold strong social or political views. The app never raises any of it, never argues a side, and never agrees with a claim on your behalf; when someone else brings it up, one of your suggestions is always a way not to get into it. \"How I Am With Different People\" — whether you're more formal, more open or more guarded with family, close friends, strangers, children and people in authority. Suggestions shift to match whoever you're talking to, and anything you've recorded about a particular person still wins. \"How I Handle Things\" — what you do when there's tension, and one thing you'd want people to understand about you.",
    "Sound Check has three new questions about taking the edge off — how you'd answer when you don't know something, when you knock something over, and when someone has kept you waiting. Picking the lighter reply teaches the app your particular way of brushing something off, which is the difference between a suggestion that sounds like you and one that just sounds polite. It won't repeat the exact line you picked; it writes a fresh one in the same spirit.",
    "Conversations now cost noticeably less to run. The app sends the AI a large set of standing instructions plus everything it knows about you on every single suggestion — and until now it paid full price for all of it, every time. It now sends that part once and refers back to it for the rest of the conversation, which cuts the bill for a typical conversation by around a third to a half. Nothing about the suggestions themselves changes. Settings → About shows how much is being saved, as the share of each request that did not have to be sent again; it climbs as a conversation goes on and resets when you start a new one.",
    "The running cost on Settings → About is more accurate. It now prices the discounted part of each request at the lower rate it is actually billed at, so the figure matches your Anthropic bill instead of estimating high.",
    "Two new sections in About Me: \"What I'm Like\" and \"What Matters to Me\". Ten short questions each. The first is about your personality, the second describes people and asks how much each one sounds like you. Every question is optional and none of it is ever brought up in conversation — it only helps the app judge how you would react and which of several suggestions actually fits you. Answering in the middle counts as no answer, so you can skip anything you do not feel strongly about.",
    "You can now tell the app how you talk with each particular person. Open someone in About Me → People and tap \"How I talk with them\": whether you are more relaxed or more careful with them than you usually are, shorter or fuller, warmer or more matter-of-fact, more direct or more hedged, more playful or more serious. You can also say what you want out of the relationship, and add anything else in your own words. When you tap that person in the Express Panel, your suggestions are worded the way you actually speak to them. None of it is ever raised as a subject — it only changes how things are put.",
    "A person can have their own conversation starters, wind-downs and goodbyes. When they are the person you are talking with, theirs come up first and your usual ones follow, so adding one for somebody takes nothing away anywhere else.",
    "If you use Reframe to correct a suggestion — \"keep it short\", \"be more direct\" — and find yourself asking for the same thing more than once, the app now takes that as a standing preference instead of making you repeat it every time. You can see what it has picked up, with how many times you asked, and remove anything you disagree with. Corrections typed in a conversation you marked \"don't save\" are not kept.",
    "How I Sound now also covers the things you say when you start a conversation, not only when you reply — opening, asking for something, and finishing up.",
    "The same section can now read back your own past conversations and pick out the sentences you typed yourself, to use as a guide to your wording. It only reads when you ask it to, it never uses the app's own phrases or the suggestions it wrote for you, and you can remove anything that does not belong — removals stick. Conversations you marked \"don't save\" are not read, because they were never written down.",
    "New How I Sound section in About Me. It shows a few ways of saying the same thing and asks which you would rather say. The app uses your answers to write suggestions in your words instead of its own. The situations are made up and nothing you pick is kept as a fact about your life — it is only about wording. You can hear any of them read aloud before choosing, and change any answer later.",
    "The same section has a Things I never say list. Anything you put there is off limits for the app when it suggests responses.",
    "Two new About Me topics: Topics I Seek and Avoid and Dislikes & Pet Peeves. Anything you list under \"what would you rather not be asked about\" is something the app will never bring up on its own, and if the other person raises it you will always be offered a way to move the conversation on.",
    "The Express Panel now starts half full instead of completely full. The everyday words are still there — Yes, No, Okay, Please, Thank you, Sorry, Hi, Bye, Wait, Help — and the rest of the buttons are blank, waiting for your own words. Nothing is removed from a panel you have already set up.",
    "Practice Mode no longer switches the microphone on. Starting a practice conversation with one of the conversation starters used to turn on real listening, which Practice Mode is never meant to do — the AI plays the other person, so there is nothing to listen to.",
    "Starting a conversation with a phrase from the Express Panel — or by typing one in \"In my own words\" — now turns listening on straight away, so the other person's reply is picked up. Before this, if you opened a conversation that way without first tapping Listen, the app stayed quiet and missed what they said back. Tapping Listen yourself, and the \"resume listening automatically\" setting, both work exactly as they did.",
    "Once a week, when you open the app, it now sends us a short report so we can see how it is holding up without having to ask you. It contains counts and timings only — never anything you or anyone else said, and never your API keys. The Troubleshooting tab lists exactly what is in one, shows when reports were sent, and has a switch to turn them off.",
    "A Tester name field on the same tab. It is the only thing that tells us whose report is whose, so please leave it as we set it.",
    "New Troubleshooting tab in Settings. If something goes wrong, write a line about it in your own words and either save it as a file or copy it — everything technical is attached for you, so you never have to describe your device or dig out a version number.",
    "There is also a small \"If something is wrong — save a report\" link under the Start button, for the case where the app is too stuck to reach Settings at all.",
    "The same tab shows a plain summary of how the app is being used — how many conversations you have had, how often one of the suggested cards fitted, and how long the other person waited. It is built from your saved conversations, and it contains only counts and timings, never anything anyone said.",
    "Your API keys are never included in a report, on purpose. It says whether a key is set, and nothing more.",
    "The error log has moved from the About tab to Troubleshooting, alongside everything else you would need when reporting a problem.",
    "The app now offers you responses much sooner after the other person pauses. It used to wait two seconds of silence before asking the AI; it now waits half a second, and refines the suggestions each time they pause again. You can change this under Settings → Conversation → Silence period.",
    "The short phrases the app says while you are choosing (\"I'm thinking about that.\") now start two seconds after the other person stops, instead of waiting for the suggestions to arrive. Previously they could land at the same moment the cards appeared, which is too late to be of any use in holding the conversation.",
    "Those phrases have been rewritten so they make sense after anything the other person says — a question, a comment, or a greeting. The app no longer says \"Good question.\" when no question was asked."
  ],
  "0.6.7": [
    "Tapping where you are now means you are standing there, rather than nudging the conversation onto that place as a subject. What the place is for still shapes the suggestions — at your comic shop, comics are an obvious thing to be talking about — but the app no longer steers there when the other person has asked about something else. It also stops offering options that treat the place as somewhere you visit and remember, like \"what did you find here last Saturday?\" asked while you are standing in the shop. What the app knows about the place is still fully in play; it is used to make the options fit where you are, instead of being read back to someone who is standing there with you. The same goes for tapping who you are talking with: it says who is being spoken to, not who you want to talk about."
  ],
  "0.6.6": [
    "Stopping and restarting Listen in the middle of what someone is saying no longer throws away the first half of it. The Listen button controls the microphone, not the conversation: if you stop it while the other person is still mid-turn and start it again, what they had already said is kept and the rest is added on, so their turn arrives whole. Their turn is finished when you reply, ask them to say it again, or end the conversation — not when you tap the button.",
    "Fixed: when using Deepgram for transcription, the Listen button went dark as soon as you started speaking, even though the app was still listening. Tapping it again then looked like it did nothing, but it quietly started a new recording and threw away what the other person had said so far — so a long turn came out with only the last few words kept. The button now stays lit for as long as it is listening, and tapping it stops listening as it should."
  ],
  "0.6.5": [
    "Suggested responses will no longer contain swearing or crude language. This is not something the app should decide for you, so a later release will let you allow it for particular people you talk to; until then it is simply off.",
    "Suggested responses are no longer written with texting shorthand. The AI was not being told that everything it writes gets spoken out loud, so it could offer something like \"I fw it\" — which looks like a normal reply on the card but is not something a speaking voice can say. Responses are now written the way they are said. How casual or slangy you sound is still up to you and comes from About Me.",
    "The Test button beside the Deepgram key now makes the same connection the app makes when it listens, instead of a simpler one. It could previously report that your key was working while listening itself failed, which sent you looking in the wrong place. It also now reports the microphone rate it used and, when a connection is refused, the reason the service gave.",
    "If you use Deepgram for transcription, the Listen button no longer lights up red for a moment and then goes dark when the connection cannot be made. It now lights up only once listening is really running, and when a connection is refused the reason is written to the error log (Settings → About) instead of being lost.",
    {
      "for": "computer",
      "note": "Turning on \"Use the whole screen\" while the Settings panel was open drew the conversation screen on top of Settings, hiding it until you closed Settings and opened it again. Settings now stays in front."
    },
    {
      "for": "ipad",
      "note": "\"Use the whole screen\" has been removed. It did nothing when the app was installed on the Home Screen — an iPad always shows its status bar, so there was nothing to gain — and in the Safari browser it stopped Settings from opening and left the Listen button stuck on. If you had switched it on, it no longer has any effect."
    }
  ],
  "0.6.4": [
    "Making a keyguard: the Title Bar Height box now looks after itself. If the app is using the whole screen there is no bar above it, so the box greys out and says so, and the openings file is generated with no offset. Before, a height left in the box from an earlier setup would have shifted every opening down the screen — something you would only discover after the plastic was cut.",
    "\"Use the whole screen\" now starts switched off. It was on when it first shipped. Off is a better place to start: the title bar is the easiest way to close the app and costs very little height, and if you want the extra room you can simply maximise the window and keep the title bar. Use the setting when you want to expand the app right out, and turn it off again to come back. If you already chose one way or the other, your choice is kept."
  ],
  "0.6.3": [
    "My Places — tell the assistant where you are. A new section in About Me where you add the places you go and anything worth knowing about each one: what you usually order, who you go with, the address if it's one particular branch. You choose what to record — every place is different, so nothing is a fixed question.",
    "Place buttons in the Express Panel. Add a place the same way you add a person, then tap it during a conversation to say \"I'm here right now\". The assistant then suggests responses that fit where you are, and knows what you told it about the place. Unlike the partner and feeling buttons, a place stays on when a conversation ends — ending a conversation doesn't move you, so several conversations in the same place cost one tap, not one each. Tap it again to turn it off, or tap a different place to switch.",
    "Buttons no longer stay highlighted after you tap them. On a touchscreen a button kept the dark \"pointing at it\" colouring after being tapped, because there is no mouse to move away — most obvious on the \"New 4\" button, which turned dark and stayed that way. Every button on the conversation screen now only highlights on a device that really has a pointer.",
    "The choice you tap now stays lit up. When the other person offers you a set of options and you tap one in the Express Panel, that button now shows as chosen and stays chosen — so when you ask for a new set of responses, you can see they are still about the option you picked.",
    "The app now uses the whole screen. A new \"Use the whole screen\" setting on Settings → General, on to begin with, hides the bars around the app so the conversation gets the extra height — about a tenth more room top to bottom. Turn it off if you have a keyguard cut for the smaller layout, because filling the screen moves every button.",
    "A place can be marked private, which works exactly as it does for a person: the assistant knows about it, but won't raise it on its own. It will offer it if the other person asks, or if you ask for it yourself by typing what you want to say in \"In my own words\" and tapping Reframe. And as always, nothing is said aloud until you tap it."
  ],
  "0.6.2": [
    "The two buttons at the top of Settings are much bigger. The help and close buttons now follow the same minimum size as every other button, so it is far harder to close Settings when you meant to ask for help. This makes the bar across the top of Settings taller.",
    "Settings can now tell you what a setting does, out loud. There is a question mark button next to the X at the top of the Settings panel. Tap it, then tap any setting, its label, or a tab, and the app says what that one does. Tapping a setting while help is on does not change it, so you can ask about something without altering it by mistake. It answers one question at a time and then switches itself off, so you are never stuck in help mode when you actually want to change a value. If you have heard enough, tap anywhere to stop it — and tapping the same setting again both stops it and does what that setting normally does.",
    "New \"Screen edge margin\" setting, for keyguards in a tight tablet case. Some cases have an opening that fits so closely to the screen that a keyguard has nowhere to rest around the outside. Settings → Keyguard Design now has a Screen edge margin slider that moves the whole app inwards from the edges of the screen — including the Express Panel and keyboard, which sit closest to the edge. Everything shrinks to fit, so nothing is pushed off. It starts at zero, so nothing changes until you move it. Note that it does move every button, so a keyguard cut before you change it will no longer line up. This is separate from Keyboard separation, which sets the gap between the keyboard and the rest of the screen and leaves the keyboard where it is; the two can be used together without doubling up.",
    "The Settings title bar is easier to pick out. It was the same dark colour as the bar at the top of the app window, so the two ran together and looked like one band. The Settings bar is now light grey with dark lettering.",
    "Buttons and dropdowns in Settings are much bigger, and now follow the size you chose for your Express Panel buttons. Some were far too small to tap reliably — the Copy and Clear buttons by the error log were about a third of the width of a regular button, and every dropdown was shorter than any button in the app. Settings controls are now at least 70% as wide and as tall as one of your Express Panel buttons, so making your Express Panel buttons bigger makes these bigger too. Not 100%, because Express Panel buttons also get wider when a layout shows fewer of them at once, and a Settings button does not need to be that wide.",
    "The app no longer records an error every time you start it. A line reading \"storage warm-up did not finish within 6000ms\" was being written to the error log at Settings → About at the start of every session, and it turned the conversation area faintly red as though something had gone wrong. Nothing had: the app was finishing that step in a few thousandths of a second and then reporting a problem anyway. It no longer does. The app still tells you if that step genuinely stalls, and it now also waits patiently while your browser asks you to confirm your data folder, instead of treating your answer as being slow."
  ],
  "0.6.1": [
    "Conversant AAC has its own web address: conversant.volksswitch.org. Everyone now uses the same one — the iPad was briefly served from a separate address while iPad support was being worked out, and that is finished. The old address still works and sends you to the new one, but please update any bookmark or Home Screen icon to the new address. The move matters for more than tidiness: a browser keeps a site's saved information separate by web address, so having our own address means nothing else published under volksswitch.org can reach your API key or the information the app has saved about you. One thing to expect the first time you open the new address: the app will look brand new — no settings, no API key, and it will ask you to choose your data folder again. Nothing has been lost. Your About Me answers, the people you know, your Express Panel and your saved conversations are all in your data folder, exactly where they were. Choose that folder again, load your saved settings profile, and paste your API key back in. On an iPad there is no folder to choose, so export your data from the old address before switching, then import it at the new one.",
    "The “What’s new” summary now only tells you about changes that affect your own device. A change that only shows up on an iPad is no longer described to someone on a Windows tablet, and the other way round — instead you get a single line saying there were improvements for the other kind of device, so you know the update was not empty for other people. Changes that affect everyone, which is most of them, are shown to everyone exactly as before.",
    "Garbled characters in Settings are fixed. Dashes, quotation marks, bullets and ellipses were coming out as short runs of nonsense letters in several places, including the shortened form of your API key. This was only ever how the text was drawn; no setting or key was affected, and nothing needs to be re-entered.",
    "Settings is much less cluttered. The paragraph of explanation that sat under nearly every single setting has been taken out, so each tab now shows the settings themselves rather than pages of text to read past. Nothing was removed except the words — every setting still does exactly what it did. The explanations have moved to the user manual, where there is room to say more than a cramped panel ever allowed. Descriptions of what a whole tab is for are still there at the top of the tab."
  ],
  "0.6.0": [
    "The wording about where your information is kept now fits the device you are on. A setting called \"Do not save conversations to my data folder\" makes no sense on a tablet, which has no folder to name — it is now simply \"Do not save my conversations\". On a device where there is no folder to choose, the Data Folder section of Settings retitles itself \"Where Your Data Is Kept\" and explains where your information actually lives, instead of offering a button that could not lead anywhere.",
    "Settings closes with an X in its title bar. The full-width Close button along the bottom took a whole button's height out of every tab to hold one control. It is now a small X at the right-hand end of the blue \"Settings\" bar, and the space it used to occupy goes to the settings themselves — about four more lines of the panel on every tab.",
    "Everything about hearing and speaking is now on one Settings tab, called Speech. Voices could be set from two different tabs, and the key for the paid services could only be reached through the transcription choice — so if you wanted a better voice but were happy with how the app heard people, the box to put your key in was nowhere on screen. Settings → Speech now holds the key, how the app hears the other person, your speaking voice and the practice partner's voice, in that order. The two choices are independent: you can hear through your browser and speak with a paid voice, or the other way round. Only the voice list for the service you chose is shown. The tab that used to be called \"Speech & Input\" is now Buttons & Keyboard, and holds what its name says.",
    "The joke voices are out of the way. Devices — iPads especially — offer a set of novelty voices (Bahh, Boing, Zarvox, Trinoids) that are no use for talking to someone, and on an iPad they were 19 of the 68 in the list, so most of choosing a voice was scrolling past them. They are now hidden, with a Show this device's joke voices checkbox under Settings → Speech if you want them back. The practice partner's \"Auto\" setting never picks one either — on an iPad it now chooses a real voice with a British accent instead of speaking to you as Zarvox.",
    "You can now speak with a much better voice, using a Deepgram key. On an iPad the device's own voices are a dead end — there is one ordinary voice (Samantha) and a set of joke voices, and installing better ones does not make them available to the app. Under Settings → Speech → Your speaking voice you can now switch to a Deepgram voice and pick from sixteen, including British and Australian ones, with a Test this voice button so you can hear each one before choosing. It uses the same key as transcription, and the practice partner gets its own voice too. Phrases the app repeats — placeholders, your Express Panel buttons, starters and goodbyes — are remembered after the first time, so they are instant and cost nothing to say again. It costs roughly three cents per thousand characters spoken. If the service cannot be reached, the app speaks with your device's own voice instead, so you are never left unable to say something. The cost shown in Settings → About now includes transcription and speaking alongside the AI.",
    "The voice list now tells you which voices are the better ones. Devices often offer the same voice twice — a plain version and a higher-quality one you downloaded — under exactly the same name, so the list showed two identical entries with no way to tell them apart. Each voice now says which it is, such as \"Ava — Enhanced\" or \"Zoe — Premium\". Voices that come in only one quality are listed exactly as before. This applies to both your own voice and the practice partner's.",
    "The screen can no longer be zoomed by pinching or double-tapping. A keyguard's holes are cut in plastic and cannot zoom with the screen, so any zoom — usually an accidental one — puts every button out from under its hole. It was also making the layout itself go wrong: zooming while you were in Settings could shrink the Express Panel and leave it shrunken until you restarted the app. If you want things bigger, the size settings are the way: Settings → Text Size for each area, and Buttons & Keyboard → Button size.",
    "Settings profiles now have an \"Update\" button, beside Load and Delete. Adjust a setting and one tap puts the change back into the profile you are using — previously you had to retype the profile's exact name in the box below and confirm an overwrite, and a small typo left you with two nearly identical profiles instead. The buttons have also moved onto their own full-width row beneath the profile list, so they are easier to hit.",
    "In Practice Mode the other person no longer sounds exactly like you. If you had never picked a voice of your own — leaving it on \"Browser default\" — \"Auto\" was handing the practice partner that very same voice, so both sides of the conversation spoke in one voice. Auto now works out which voice you are actually using and picks a different one, preferring another voice in the same language rather than simply the next one on the list.",
    "The practice partner's voice now has a Test button, like your own voice above it. It works for Auto as well, and tells you which voice Auto picked — so you can hear whether the other person will sound different enough from you before you start practising, rather than finding out mid-conversation. Both Test buttons are now full width, matching the setting above them, so they are easier to hit.",
    "\"Generate Screen Openings\" now tells you what size screenshot it measured, and refuses to run at all if the screen is zoomed. If your screenshot is not exactly the size it names, the screenshot was resized somewhere along the way — mail apps shrink attached images by default — and that alone will make the openings miss.",
    "The opening screen now shows which build you are running, in small type under the Start button — the version plus the exact code it was built from. Settings → About has the version too, but you can't reach Settings before pressing Start, so if start-up itself misbehaves this is the only way to tell a fresh delivery from a cached older one.",
    "The Start button can no longer be left waiting on your saved data. If reading your data takes too long or never finishes, the app now gets on with it after a few seconds and opens the conversation, rather than sitting on the opening screen indefinitely.",
    "The Paste button beside your API key now tells you what happened. If it can't reach the clipboard it says so and tells you to touch and hold the box and choose Paste instead, rather than looking like a button that does nothing.",
    "You can now back up everything in one file, and put it back. Settings → General has a new Backup & transfer section. Export my data saves your About Me answers, the people you know, your Express Panel, your starters and control phrases, your settings, and your saved conversations into a single file you can keep somewhere safe or carry to another device. Import from a backup puts it all back. Before anything is replaced you are shown exactly what the file contains and when it was made, so you can be sure it is the right one. Your API key is never written into a backup, and importing someone else's backup will not disturb the key already on your device.",
    {
      "for": "ipad",
      "note": "Conversant AAC now runs on the iPad, as a supported platform. Open it in Safari — either as a page, or added to your Home Screen so it gets the whole screen — and see the new User Manual for iPad for the difference between the two, which is worth understanding before you choose. One thing to know up front: Apple does not allow a Home Screen app to use the iPad's own speech recognition, so hearing the other person there needs the same paid Deepgram key as the voice above. Many smaller iPad fixes — layout, start-up, the Express Panel, the listening tone — landed alongside it and are not listed individually."
    },
    {
      "for": "computer",
      "note": "Backups are now saved into your own data folder. \"Export my data\" used to hand the file to your browser, which dropped it into Downloads among everything else you have ever downloaded. It now writes it to a backups folder inside the data folder you chose — beside the data it protects, in the place you already know and already copy between machines. The backups it finds there are listed by date underneath, so putting one back is choosing it from the list and tapping Restore selected backup; you no longer have to go hunting for the file. Importing a file from somewhere else still works, for a backup that came from another machine. On a device with no data folder to choose, nothing changes — the backup is saved through your browser exactly as before."
    }
  ],
  "0.5.98": [
    "When someone offers you a set of choices, you now get all of them. If your partner asks something like \"would you say it's mild, moderate, or severe?\", the response cards are now the choices they actually offered — one card each, in the order they said them — plus a card for when your real answer isn't on their list (\"it's somewhere in between\"). Previously all four cards were different ways of saying the same one of their choices, so the others were out of reach unless you typed them yourself. This works however they offer the choices — whether they ask \"mild, moderate, or severe?\" or simply mention what's available, as in \"we've got muffins, croissants, and a few different pastries — anything jump out at you?\". If one of the things they mention is vague, its card asks about it (\"What kind of pastries do you have?\") rather than guessing. Just listing things in passing — \"I picked up milk, eggs, and bread\" — is not an offer and is left alone. If they only offer two choices, the two spare cards are filled with the answers people actually give — \"About the same.\", \"It comes and goes.\" — or a question back to them, rather than being left empty.",
    "Choice buttons in the Express Panel, for when you want to say more. Those same choices also appear as green buttons at the start of the Express Panel. Tapping one — \"moderate\", say — asks the AI for a full set of responses all about that choice: a plain way to say it, a more hesitant one, one that adds a detail. So you can answer in one tap from the cards, or take a moment and say something fuller about one of them. The buttons appear only while a choice is on offer, and take only as many spaces as there are choices — your phrases shift along to make room and slide back afterwards. You can cap how many appear, or turn them off, under Settings → Conversation.",
    "The listening beep no longer sounds after every single exchange. If you have \"resume listening automatically\" turned on, the microphone restarts each time you reply, and the beep was sounding every time — which turned a one-time \"this device is listening\" cue into a constant interruption. It now sounds once, at the start of the conversation. With automatic resuming turned off, every time you tap Listen still beeps, because each one is a fresh, deliberate start.",
    "\"Actually, before you go —\" when someone starts saying goodbye. When the other person begins wrapping up, the goodbyes now come with one extra card that holds them a moment, so you are not limited to either saying goodbye or scrambling to type. Choosing it speaks the phrase, keeps the conversation open, and hands the floor back to you. You can reword it under Settings → Controls, and it stays put when you press \"New 4\" for different goodbyes.",
    "Better at noticing when someone is wrapping up. People rarely end a conversation by saying \"goodbye\" — they start with \"Well…\", \"Anyway…\", \"I should let you go\", \"It was good seeing you\", or \"Have a good one\". The app now recognises these as the beginning of a goodbye, while still leaving well alone when the same words simply introduce a new topic (\"Anyway, what did you think of the film?\").",
    "You can see what your partner is saying as they say it. While they were speaking, their words-so-far often sat just out of sight below the bottom of the conversation area, hidden behind the row of buttons — and only came into view once they finished. The conversation now keeps their in-progress words in view the whole time they are talking.",
    "\"New 4\" no longer forgets what you asked for. If you picked one of their choices — or typed something into Reframe — and then pressed New 4 for different wording, it used to throw that away and go back to the plain options. Now it keeps it: you get four different ways of saying the same thing. Your steering lasts as long as their turn, so once you reply it starts fresh.",
    "Practice Mode moved into Settings. Practice now lives on its own Practice tab in Settings, instead of a button on the opening screen — so you can drop into a practice conversation at any time, not just before you start. The tab lists the scenarios to choose from, and while you are practicing it shows which one you are in, with an End practice button to stop. Ending a practice conversation (either with that button or with End conversation) now returns you straight to the normal conversation screen, ready for a real conversation, rather than back to the opening screen."
  ],
  "0.5.97": [
    "Practice Mode — rehearse a conversation with the AI. On the opening screen, tap \"Practice a conversation\" and pick a scenario (ordering coffee, meeting a new colleague, a doctor's visit, catching up with a friend, a job interview). The AI plays the other person — it speaks their part aloud in its own voice — and you reply by choosing response cards, exactly like a real conversation, but with no microphone and no time pressure. Tap \"Start Listening\" to hear the other person's next turn, just as you would in a real chat. You can set the practice partner's voice in Settings → Speech & Input, and End conversation returns you to the opening screen. (Practice needs a Claude API key, since the AI both plays the partner and suggests your responses.)"
  ],
  "0.5.96": [
    "A clearer, one-at-a-time startup. The opening screens now appear in order — press Start, then (if the app just updated) the \"What's new\" summary, then a note about the API key — instead of the API-key note piling on top of the \"What's new\" screen. The API-key note explains that a key is what lets the AI suggest responses, with two buttons: \"Close\" to go straight into the app (listening and speaking in your own words work without a key) and \"Add API key to Settings\".",
    "A clearer sign that the device is listening. When you start listening, the app now plays a short chime and the Listen button turns red and gently pulses while the microphone is on. The chime is an audible heads-up for the person you're talking with — they're facing you, not the screen — that the device has started listening. You can turn the chime off in Settings → Conversation (\"Play a chime when listening starts\"); it's on by default."
  ],
  "0.5.95": [
    "No more flicker when you pick a response. Selecting a response card no longer makes a scrollbar flash across the whole screen and the command buttons and cards briefly shrink and jump left. Only the conversation area scrolls now, and the buttons stay put.",
    "The conversation scrollbar is wider and easier to grab. The scrollbar on the conversation area is now a chunky, high-contrast bar — much easier to use with limited hand control.",
    "Your spoken statements now sit in a neat bubble. Each of your statements in the conversation is now only as wide as its words (a bubble on the right), instead of a wide blue band that stretched most of the way across."
  ],
  "0.5.94": [
    "The app now tells you when your API key is missing or looks wrong. On the opening screen, if you haven't added your Claude API key yet, a clear notice appears above Start explaining the AI can't suggest responses until you add one (you can still Start and speak in your own words). In Settings → General, typing a key that doesn't look right (wrong start, spaces, too short) shows a red note under the field.",
    "New \"Test\" button for your API key (Settings → General, next to Paste). Tap it to check your key against Anthropic — it tells you \"✓ Your key is working\" or \"✗ The key was rejected,\" which catches a key that was pasted incompletely. The test costs nothing."
  ],
  "0.5.93": [
    "Winding down and saying goodbye are now two separate steps. Tapping Wind down shows statements that signal you'd like to wrap up (\"I should get going.\", \"Great catching up with you.\") — not goodbyes. Once you pick one, the actual goodbyes (\"Bye!\", \"Take care!\") appear automatically. If the other person doesn't take the hint, tap Wind down again to politely restate it.",
    "More wind-down statements and goodbyes to choose from. When you've set up more than fit on screen, the New button (and tapping Wind down again) brings up a different set — it also works this way for your conversation starters."
  ],
  "0.5.92": [
    "\"Ask them to repeat\" now keeps the reply as its own turn. After you ask the other person to repeat, what they say next appears as a new turn after your \"could you say that again?\" line — instead of being tacked onto the end of what they said before.",
    "Sentences no longer run together in the transcript. When someone's speech comes in as separate pieces, they're now joined with a space (\"Good morning. How was your weekend?\") instead of stuck together (\"Good morning.How was your weekend?\")."
  ],
  "0.5.91": [
    "A placeholder no longer talks over a button you pressed. Pressing a button that speaks — a response, an Express Panel phrase, or Repeat what I said / Hold on — now stops any \"let me think\" placeholder instantly, so it can't cut in partway through what you're saying. (Your response options still appear as usual.)"
  ],
  "0.5.90": [
    "The app's own speech no longer leaks into the other person's words. When the app spoke — a placeholder, or a repeated statement from \"Repeat what I said\" — the microphone sometimes caught a piece of it (often slightly mis-heard, like \"still\" as \"steel\") and tacked it onto what the other person said. The filter that removes the app's own voice is now much better at catching those partial and mis-heard pieces, so they're kept out of the conversation. The microphone still stays on the whole time, so the other person can still talk over the app."
  ],
  "0.5.89": [
    "Fixed: a repeated statement no longer jumps above the other person's words. When you used Repeat what I said (or Hold on / Ask them to repeat) while the other person's latest words were still on screen, your spoken line was shown above theirs. It now appears in the right place — after what they said — matching the saved record."
  ],
  "0.5.88": [
    "Saved conversations are now written as they happen. The conversation file kept in your data folder now mirrors what's on screen moment to moment — it's created the instant you start listening, the other person's words are saved at each pause (and updated as they keep talking), and your responses are saved the moment they appear. So if the app ever hiccups mid-conversation, the saved record still shows exactly what led up to it."
  ],
  "0.5.87": [
    "The settings-profile picker now shows which profile is in use. After you save or load a profile — and after restarting — the drop-down reflects the profile that's actually in effect (with an \"In use\" note), instead of resetting to the first name in the list. (Your settings were always applied correctly; only the name shown was wrong.)",
    "Press Enter to save a settings profile. Typing a name in the profile box and pressing Enter now saves your current settings under that name.",
    "\"Ask them to repeat\" no longer erases what the partner said. Tapping it asks the partner to say it again and keeps listening, but it now keeps everything they'd already said in the conversation — their repeat is added to it, nothing is thrown away.",
    "Renamed the setting \"'Pardon?' phrase\" to \"'Ask them to repeat' phrase\" to match the button's name.",
    "Fixed: the partner's full words are kept when you interrupt them. If you cut in (with an Express Panel phrase or \"In my own words\") while the partner was mid-sentence, sometimes only their first few words were saved. Now everything they'd said up to your interruption is kept in the conversation and the saved transcript."
  ],
  "0.5.86": [
    "The partner's last words are kept when you end a conversation. If the partner spoke but you ended (or restarted) the conversation before choosing a reply, their words are now saved to that conversation instead of being dropped. This also fixes a bug where those words could reappear at the top of your next conversation as if the partner had just said them, even though no one had spoken."
  ],
  "0.5.85": [
    "Move between Settings tabs with the arrow keys. If you use a physical keyboard, you can now Tab once to the column of Settings tabs and then use the up/down arrow keys to jump straight to another tab — General, About Me, Speech, and so on — instead of tabbing through everything on the current tab first.",
    "The on-screen keyboard's keys are no longer part of keyboard \"Tab\" navigation. Tabbing through Settings with a physical keyboard used to walk through all forty-odd on-screen keys; it now skips them (you still tap them as before).",
    "A \"Save\" button on each Express Panel item. When you edit a phrase, partner, or feeling and are using the on-screen keyboard, tap that item's Save to keep the change and put the keyboard away so you can see the panel again.",
    "Clearer names for the keyboard/Express Panel layouts. In Settings they're now \"Side Layout 1\", \"Bottom Layout 1\", and so on (they set the layout for both the on-screen keyboard and the Express Panel).",
    "Simpler wording on the button that loads a saved settings profile: just \"Load\"."
  ],
  "0.5.84": [
    "Fixed: wind-down replies now show the right number of cards. When the other person replied to your wind-down and the app offered your goodbyes again, it showed eight of them even when you'd chosen one card per category. It now matches your setting — four cards (or eight, if you picked eight).",
    "Faster goodbyes. While you're wrapping up, if the other person simply says goodbye, your closing cards now come back right away instead of after a short wait — so you can say your own goodbye sooner. (If they say something other than a plain farewell, the app still asks the AI for suggestions as usual.)",
    "You can now Tab between the controls in the \"In my own words\" box. Pressing Tab (or Shift+Tab) on a physical keyboard cycles through the typing box and the Speak, Reframe, and Cancel buttons instead of jumping away to controls behind the box.",
    "Keyguard-design settings are together on the Keyguard Design tab. \"Keyboard separation\" moved there from Speech & Input, and a new \"Transcript separation\" sets the gap between the transcript and the buttons below it (by making the transcript a little shorter). Both leave room for a keyguard bar without moving any button holes."
  ],
  "0.5.83": [
    "About Me now opens like every other Settings tab. Instead of taking over the whole screen with its own title bar and \"Done\" button, About Me appears in the panel next to the Settings tabs, just like General, Text Size, and the rest. Use the same Close button to return to the conversation.",
    "Save and reload your settings as named profiles. In Settings → General → Settings profiles, you can now save all of your settings (voice, silence period, dock and layout, button and gap sizes, tap mode, text sizes, placeholders) under a name, and bring them back later in one tap. Handy for keeping a known setup to return to, or copying your setup to another device — the profiles are stored in your data folder. Your API key and cost counters are not included.",
    "Fixed: saying goodbye no longer repeats the other person's last words. When you picked several farewells in a row from Wind down (for example \"Great seeing you,\" then \"This was really nice,\" then \"Bye!\"), the other person's final sentence was wrongly repeated in the conversation before each of your goodbyes. It's now recorded just once, the way it was actually said."
  ],
  "0.5.82": [
    "The app no longer goes quiet trying to guess when the other person is finished. Every time the other person pauses, it offers response suggestions (and refines them if they keep talking), until you pick one or end the conversation — you decide when their turn is over, not the app. This removes a whole class of glitch where a conversation you started could stall with no responses and no thinking-out-loud placeholder."
  ],
  "0.5.81": [
    "Fixed: conversations you start yourself now work. When you opened a conversation with a starter (for example \"Hi Tyler, got a minute?\") and the other person replied with a short go-ahead (\"Yeah, sure — any time\"), the app could go silent: no thinking-out-loud placeholder and no suggested responses. It now correctly treats their reply as your cue to lead and offers responses as expected."
  ],
  "0.5.80": [
    "Fixed a leftover clipped-looking border on the \"In my own words\" box. A thin framing line around the box had a rounded corner that got cut off at the edge of the response area, making it look broken. It's now flush and borderless, matching the response cards behind it."
  ],
  "0.5.79": [
    "The app keeps working when the AI can't be reached. If the AI service (or your internet) is unavailable, response suggestions can't be generated — but the partner's words are still shown in the transcript in blue italics (raw, since the AI couldn't tidy them up), the transcript takes on a faint red tint to flag the hiccup, and the problem is recorded in the error log. You can keep the conversation going with the Express Panel and \"In my own words\" — everything you say is spoken, shown in the transcript, and saved as usual. (Note: the browser's speech recognition itself needs an internet connection, so with no internet at all the partner's words can't be transcribed — the red tint is your signal that something's wrong.)",
    "Cleaner \"In my own words\" box. The typing box no longer draws a border around itself, and the Cancel button now has the same dark border as Reframe."
  ],
  "0.5.78": [
    "When the partner asks you to repeat, all three options now show the actual words. If the partner doesn't catch what you said, the \"say it again / say it differently / explain it more\" choices now display the real, ready-to-speak sentences on the cards (prepared the moment they ask), so you can read and pick — instead of showing a label and only producing the wording after you tap.",
    "\"Don't save this conversation\" now covers everything. When a conversation is marked not to be saved, the partner's words are also kept out of the app's error records and out of any copied bug report — previously a technical hiccup could still tuck a snippet of what the partner said into those. Nothing from a private conversation is written down now.",
    "With 8 response cards chosen, you now see 8 slots everywhere. When \"Suggestions per category\" is set to 2 (8 cards), the response area now shows eight slots when the app opens and between turns — not four — so it matches what you see while choosing a reply, and a keyguard lines up the same way throughout.",
    "More conversation closings, so \"Wind down\" fills all eight. There are now eight built-in closings (added \"I need to head out.\", \"Let's talk again soon.\", \"Take care!\", \"Catch you later.\") to match the eight starters, so an 8-card layout fills every slot when you start or end a conversation.",
    "New built-in starters and closings now appear automatically. When an update adds new default conversation starters or closings, they're added to the end of your existing list on their own — you no longer have to reset to see them. Anything you've edited or removed is still respected: your own wording stays, and a card you deleted won't come back.",
    "A placeholder now plays after anything the partner says — including a greeting. Previously the \"I'm thinking…\" placeholders only played after a question. Now the partner always hears a short response coming while you choose, so they're never left wondering whether you heard them or can communicate. After a question you'll hear a question-style \"Good question.\"; after a greeting or statement, a neutral \"Let me see.\" / \"One moment.\" (The initial delay and the per-turn limit still apply, so a quick pick plays none, and you can still set the limit to 0 to turn placeholders off.)"
  ],
  "0.5.77": [
    "Interrupting the partner now records what they had said. If you cut in with an instant statement (like a \"Bye\" Express phrase) while the partner is still talking, the words they'd said up to that point are now saved in the transcript — placed just before your interruption — instead of vanishing. If auto-listen is on, the partner keeps being recorded afterward too if they continue."
  ],
  "0.5.76": [
    "Errors are now saved inside the conversation file, in order. If something goes wrong during a conversation, the problem is written into that conversation's saved record at the moment it happens, in time order with what was said — so a support report shows exactly what failed and when. (Your turns were already saved as they happened; this adds the errors alongside them.)",
    "Each conversation is saved to its own file again. A second conversation in the same session no longer gets appended to the first conversation's file.",
    "More ways to start a conversation. Five new conversation starters were added, and when you have \"Suggestions per category\" set to 2 (eight cards), Start conversation now fills all eight cards with different openers.",
    "Your own statements go straight into the transcript. When you pick a response, type your own words, or tap an Express phrase, it is added to the conversation right after it has been spoken, instead of appearing first as a faint \"about to say\" preview line. That preview line is now only used for the app's place-holding phrases.",
    "\"Repeat what I said\", \"Hold on\", and \"Ask them to repeat\" now appear in the transcript. Anything the app says out loud for you is now part of the written conversation.",
    "Saying goodbye is quicker. After you pick a wind-down or closing line, the closing options (including \"Bye!\") stay on the cards so you can sign off without waiting for the other person to reply first.",
    "\"In my own words\" while you hold the floor now suggests statements to steer the conversation. If you've just spoken and it's your turn to lead, type where you'd like things to go and tap Reframe — the app offers statements that take the conversation there, instead of replies to a question.",
    "Fixed-purpose buttons show an icon. Buttons whose job never changes (like \"In my own words\") now show a clear icon with a tooltip, matching the rest of the control buttons."
  ],
  "0.5.75": [
    "The conversation area turns faintly red if the app hits a problem. If something goes wrong while getting responses, the conversation box gets a soft red tint — a quiet heads-up that a hiccup happened and things may act oddly for a moment (and worth mentioning if you report it). It clears on its own the next time responses come through normally, or when you start or end a conversation."
  ],
  "0.5.73": [
    "Error reports now include the conversation. The error log groups errors by the conversation they happened in (newest first), and Copy puts a full report on the clipboard — each conversation's transcript together with its errors — so you can send the whole picture, not just the error message."
  ],
  "0.5.72": [
    "The app now keeps an error log you can look at. When something goes wrong — most importantly when the AI doesn't return any response options — it's recorded with a timestamp and the conversation it happened in, so a problem from a live demo leaves a trace. View it in Settings → About → Error log (with Copy and Clear); it's also saved as errors.log in your data folder.",
    "You now see why response options didn't appear. If a generation request fails, the response area shows the reason and a Try again button instead of just sitting empty."
  ],
  "0.5.71": [
    "Word prediction: tap the box to accept a suggestion, not space. The suggested word completion is now taken only when you tap anywhere in the typing box — typing a space, comma, period or Enter no longer accepts it. This fixes cases like typing \"Yes\" and ending up with \"Yesterday\" when you only wanted \"Yes\" followed by a space (which could happen without you even seeing the box)."
  ],
  "0.5.70": [
    "The on-screen keyboard now stays put when you open \"In my own words.\" On the tablet the keyboard could still fail to appear (or vanish immediately) when the typing box opened — especially right after using an Express Panel phrase. It now stays up the whole time the typing box is open, in both the side and bottom layouts.",
    "A \"Reload the app\" button in Settings → About. Forces a fresh reload to pick up the latest version — the same as a hard refresh, but without needing to attach a keyboard to press Ctrl+Shift+R.",
    "\"In my own words\" buttons are now a single row in the side layout too. Speak, Reframe and Cancel sit in one horizontal row in both the side and bottom layouts (previously Speak and Reframe were stacked in the side layout)."
  ],
  "0.5.69": [
    "Conversations you start yourself are now saved. When you opened a conversation with an opener or an Express Panel phrase, that first thing you said wasn't being recorded — and if the whole conversation was just you speaking (no partner captured), nothing was saved to your data folder at all. Now the conversation is recorded from your very first words.",
    "The keyboard now always appears when you open \"In my own words.\" In some situations — especially right after using an Express Panel phrase — the typing box could open without the on-screen keyboard showing. It now comes up reliably.",
    "The \"In my own words\" buttons now line up with the response cards. Speak and Reframe sit exactly over the response-card area and Cancel over the \"New 4\" button, so a single keyguard fits both the response cards and the typing buttons — in both the side and bottom layouts."
  ],
  "0.5.68": [
    "The \"What's new\" notice is easier to read — it fills the transcript area, drops the header line, and moves the Close button up next to the title, so more of the space is given to the list of changes."
  ],
  "0.5.67": [
    "The \"What's new\" notice now appears in the transcript area (rather than centered on the screen), so it stays clear of a keyguard. Press Start to see it, then tap \"Got it\" to begin."
  ],
  "0.5.66": [
    "The \"What's new\" notice now appears right after you press Start, instead of on the opening screen. It stays up until you tap \"Got it\", so you can read it at your own pace."
  ],
  "0.5.65": [
    "The temporary welcome line beneath the Start button has been removed.",
    "The \"What's new\" notice now stays on screen until you dismiss it. It no longer disappears on its own when the app finishes updating — read it at your own pace, then tap \"Got it\" (or just press Start)."
  ],
  "0.5.64": [
    "A short welcome line now appears beneath the Start button on the opening screen."
  ],
  "0.5.62": [
    "See what's new after an update. When the app updates itself to a newer version, it now shows a short \"What's new\" summary of the features and fixes you've just received, so you always know what changed. You can also reopen it any time from Settings → About → \"See what's new in this version\"."
  ],
  "0.5.61": [
    "Cleaner About Me pages. Removed the redundant back button from the bottom of the About Me question pages; use the \"‹ Back to topics\" link at the top."
  ],
  "0.5.60": [
    "\"Prefer not to say\" no longer erases your answer. Marking a question as \"Prefer not to say\" now keeps whatever you had already entered, hidden from the AI, and an Undo brings your answer back. Previously it could discard an answer you had saved.",
    "Clearer buttons in About Me. The button that returns to the topic list is now labeled \"‹ Back to topics\", so it's no longer confused with the Done button that closes About Me.",
    "Simpler setting names. \"Minimum gap\" is now Minimum spacing, \"Optional Responses silence period\" is now Silence period, and the two \"Placeholder Statement Delay\" settings are now Initial placeholder delay and Subsequent placeholder delay."
  ],
  "0.5.59": [
    "\"Don't save this conversation.\" A new button on the command bar lets you keep the current conversation from being written to your data folder — useful for a private exchange you don't want stored. You can also set this as the default for every conversation in Settings → Conversation.",
    "Adjust text sizes. A new Text Size tab in Settings lets you set the size of the response cards, the transcript, the \"In my own words\" box, and the Express Panel buttons independently.",
    "Placeholders no longer talk over a returning partner. If the other person pauses and then keeps speaking, any \"still thinking\" placeholder that was about to play is now cancelled so it doesn't speak over them."
  ]
};
// @@RELEASE_NOTES_END@@

// --- semver comparison (major.minor.patch) -----------------------------------
// Returns -1 if a < b, 0 if equal, 1 if a > b. Tolerates missing parts and a
// leading "v". Non-numeric parts are treated as 0.
export function compareVersions(a, b) {
    const parse = (v) => String(v).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da < db) return -1;
        if (da > db) return 1;
    }
    return 0;
}

// --- platform scoping (Ken, Aug 1 2026) --------------------------------------
// A change that only affects one kind of device should not be announced to
// everyone: an iPad user reading about a data folder they do not have learns
// nothing, and the reverse wastes the one screen we get after an update. A note
// is either for everyone (a bare string, the common case) or scoped to one
// platform ({ for: 'ipad' | 'computer', note }).
//
// When the range DID contain notes for the other platform, we say so in one
// plain line rather than silently dropping them — the user should know the
// update was not empty for other people. Never in engine words: the reader is a
// user or a supporter, and "WebKit" means nothing to them.
export const PLATFORMS = { IPAD: 'ipad', COMPUTER: 'computer' };

const OTHER_PLATFORM_NOTE = {
    // Shown to a computer user when the range held iPad-only notes.
    computer: 'There were also improvements for people using Conversant AAC on an iPad.',
    // Shown to an iPad user when the range held computer-only notes.
    ipad: 'There were also improvements for people using Conversant AAC on a Windows '
        + 'tablet, Chromebook or Mac.',
};

const noteText = (n) => (typeof n === 'string' ? n : (n && n.note) || '');
const noteScope = (n) => (typeof n === 'string' ? 'all' : (n && n.for) || 'all');

// Flat combined list (Ken's choice) of every note for versions newer than
// `sinceVersion` and no newer than `currentVersion`, ordered newest-version-first
// so the most recent changes read at the top.
//
// `platform` is PLATFORMS.IPAD or PLATFORMS.COMPUTER. Omitting it returns every
// note regardless of scope, which is what the generator's own checks and any
// caller that just wants "was there anything at all" should use.
export function collectWhatsNew(sinceVersion, currentVersion, platform) {
    const inRange = Object.keys(RELEASE_NOTES)
        .filter((v) => compareVersions(v, sinceVersion) > 0 && compareVersions(v, currentVersion) <= 0)
        .sort((a, b) => compareVersions(b, a))                 // newest version first
        .flatMap((v) => (RELEASE_NOTES[v] || []).filter(Boolean));

    if (!platform) return inRange.map(noteText).filter(Boolean);

    const mine = [];
    let sawOther = false;
    for (const n of inRange) {
        const scope = noteScope(n);
        if (scope === 'all' || scope === platform) {
            const t = noteText(n);
            if (t) mine.push(t);
        } else {
            sawOther = true;
        }
    }
    // Only worth a line if there is something of their own to read it beside; a
    // panel consisting solely of "other people got improvements" is not an
    // announcement, it is a shrug.
    if (sawOther && mine.length && OTHER_PLATFORM_NOTE[platform]) {
        mine.push(OTHER_PLATFORM_NOTE[platform]);
    }
    return mine;
}

// Which set of notes this device should see. Deliberately a CAPABILITY test, not
// a user-agent one: iPadOS Safari reports itself as a Mac, so a UA check gets
// this exactly backwards. The folder picker is the same signal Settings already
// uses to decide whether to offer "Choose Folder", and it divides the two
// configurations precisely.
//
// Known edge, and it is the same one the Architecture Overview flags as
// unmeasured: a Mac running Safari would be classified as an iPad here. It would
// see the iPad notes, which is the better of the two wrong answers — a Mac
// without a folder picker has more in common with an iPad than with Chrome.
export function currentPlatform() {
    return storage.supportsUserChosenFolder() ? PLATFORMS.COMPUTER : PLATFORMS.IPAD;
}

// The notes to announce for this version, or [] if there's nothing to show. Also
// handles the silent baseline: a run with no prior record (brand-new user, OR the
// first version to ship this feature) just records the current version — the version
// that INTRODUCES the notice cannot announce itself. Does NOT render anything.
export function pending(currentVersion) {
    const seen = storage.loadLastSeenVersion();
    if (seen == null) {
        storage.saveLastSeenVersion(currentVersion);       // baseline, no notice
        return [];
    }
    if (compareVersions(seen, currentVersion) >= 0) return []; // already current
    return collectWhatsNew(seen, currentVersion, currentPlatform());
}

// Render the announcement as a card INSIDE the pre-start block — i.e. within the
// Transcript control's footprint, a keyguard opening, so nothing (including "Got it")
// is obscured (Ken, July 4 2026, Spatial Stability). Called after the user presses
// Start; the app has already re-rendered itself post-update, so the transcript's
// location is known. `onDismiss` runs after "Got it" (which also records the version
// as seen — deferred to that explicit acknowledgment, never at render time).
export function renderPanel(currentVersion, notes, onDismiss) {
    const panel = document.getElementById('whatsNewPanel');
    if (!panel) return;
    panel.textContent = '';

    // Defensive: never draw an empty card (title + Close but no notes). If there's
    // nothing to announce, record the version as seen and hand straight off to the
    // caller's dismiss (which enters the conversation) so the user is never left
    // staring at a contentless card that greys the command bar behind it.
    const items = (notes || []).map((n) => String(n).trim()).filter(Boolean);
    if (!items.length) {
        markSeen(currentVersion);
        panel.hidden = true;
        if (onDismiss) onDismiss();
        return;
    }

    // Header row: title on the left, Close on the right (saves the vertical space a
    // bottom button row would take — Ken). No decorative graphic.
    const head = document.createElement('div');
    head.className = 'whatsnew-head';
    const h = document.createElement('h2');
    h.className = 'whatsnew-title';
    h.textContent = "What's new in Conversant AAC";
    const okBtn = document.createElement('button');
    okBtn.className = 'whatsnew-ok';
    okBtn.textContent = 'Close';
    head.append(h, okBtn);

    const list = document.createElement('ul');
    list.className = 'whatsnew-list';
    for (const note of items) {
        const li = document.createElement('li');
        li.textContent = note;
        list.appendChild(li);
    }

    let settled = false;
    okBtn.addEventListener('click', () => {
        if (settled) return;
        settled = true;
        markSeen(currentVersion);
        panel.hidden = true;
        panel.textContent = '';
        if (onDismiss) onDismiss();
    });

    panel.append(head, list);
    panel.hidden = false;
    okBtn.focus();
}

// Record that the user has seen the current version's announcement, so it won't
// reappear on the next launch. Called only when the user taps "Got it" — deferred to
// that explicit acknowledgment, never at render time (so nothing marks it seen early).
export function markSeen(currentVersion) {
    storage.saveLastSeenVersion(currentVersion);
}
