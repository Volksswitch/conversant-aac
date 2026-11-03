"""Create the Conversant AAC FAQ page on volksswitch.org, as a DRAFT, once.

ONCE IT EXISTS, THE WORDPRESS PAGE IS THE COPY, as with the home page and the Known
Issues page. Ken edits in WordPress, so this script refuses to run if a page with the
slug already exists - running it again would overwrite his edits. Later changes go
through WordPress, or pull and push the page the way known-issues.py does.

It links to the documents PAGE, never to a PDF: a document's PDF gets a new address each
time it is republished, so a direct link breaks at the next sync.

BETA LINES come out at public release. Search the page for "During the beta". There are
two: in "What's needed to get started?" and "Who can see the conversations?".

Run: python scripts/wordpress/publish-faq.py            (prints the page text)
     python scripts/wordpress/publish-faq.py --apply    (creates the draft)
"""
import os, sys, html, re
sys.path.insert(0, os.path.dirname(__file__))

SLUG = 'conversant-faq'
TITLE = 'Conversant AAC Frequently Asked Questions'
SITE = 'https://volksswitch.org/index.php/'
U = {
    'docs': SITE + 'conversant-documents/',
    'videos': SITE + 'conversant-videos/',
    'issues': SITE + 'conversant-aac-known-issues/',
    'beta': SITE + 'conversant-beta/',
    'v11': SITE + 'conversant-videos/video-1-1/',
    'v12': SITE + 'conversant-videos/video-1-2/',
    'v13': SITE + 'conversant-videos/video-1-3/',
    'v14': SITE + 'conversant-videos/video-1-4/',
    'v15': SITE + 'conversant-videos/video-1-5/',
    'v22': SITE + 'conversant-videos/video-2-2/',
    'v23': SITE + 'conversant-videos/video-2-3/',
    'v24': SITE + 'conversant-videos/video-2-4/',
    'v25': SITE + 'conversant-videos/video-2-5/',
    'v310': SITE + 'conversant-videos/video-3-10/',
    'v46': SITE + 'conversant-videos/video-4-6/',
    'v51': SITE + 'conversant-videos/video-5-1/',
    'v52': SITE + 'conversant-videos/video-5-2/',
    'email': 'mailto:ken@volksswitch.org',
}


def a(key, text):
    return f'<a href="{html.escape(U[key])}">{text}</a>'


def p(text):
    return f'<!-- wp:paragraph -->\n<p>{text}</p>\n<!-- /wp:paragraph -->'


def h2(text):
    return f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{text}</h2>\n<!-- /wp:heading -->'


def h3(text, anchor):
    return (f'<!-- wp:heading {{"level":3}} -->\n<h3 class="wp-block-heading" id="{anchor}">{text}</h3>\n'
            '<!-- /wp:heading -->')


def ul(items):
    li = ''.join(f'<!-- wp:list-item -->\n<li>{i}</li>\n<!-- /wp:list-item -->' for i in items)
    return f'<!-- wp:list -->\n<ul class="wp-block-list">{li}</ul>\n<!-- /wp:list -->'


def ol(items):
    li = ''.join(f'<!-- wp:list-item -->\n<li>{i}</li>\n<!-- /wp:list-item -->' for i in items)
    return f'<!-- wp:list {{"ordered":true}} -->\n<ol class="wp-block-list">{li}</ol>\n<!-- /wp:list -->'


# (group heading, [(question, anchor, [blocks])])
FAQ = [
    ('About Conversant', [
        ('What is Conversant AAC?', 'what-is-it', [
            p('Conversant AAC is a free app that helps people who use AAC take part in real conversation. '
              'It listens to the other person, shows what it heard, and offers four ways to reply within a few seconds. '
              'The user taps one, and the app says it out loud.'),
            p(f'Watch: {a("v11", "What Conversant Is For")}.'),
        ]),
        ('Who is it for right now?', 'who-for', [
            p('The first version is for someone who:'),
            ul(['is 18 or older and makes their own decisions',
                'can read the options on the screen',
                'can point at the screen, by any of the means described under “Will eye gaze, switches and keyguards work?”',
                'talks in English']),
            p('The first focus is people with cerebral palsy, but anyone who doesn’t speak and fits this list can use it. '
              'The age and decision-making limits are there because the app speaks in the user’s name to real people, '
              'and that choice should be the user’s own.'),
            p('Younger users, other languages and switch scanning aren’t supported yet. Spanish is the first language we’re exploring.'),
        ]),
        ('Does it replace a current AAC device?', 'replace', [
            p('No. Conversant doesn’t replace an AAC vocabulary system. It adds quick replies for live conversation.'),
            p('It isn’t built for writing speeches or letters, and it doesn’t handle email, calendars or reminders.'),
        ]),
        ('Does it use picture symbols?', 'symbols', [
            p('No. Every button shows words, so today’s app is for people who read. '
              'We plan to reach people who read less by lowering the reading needed a step at a time, and staying with print throughout.'),
        ]),
    ]),
    ('In a Conversation', [
        ('How does a conversation work?', 'how-it-works', [
            ol(['The other person talks, and the app shows what it heard.',
                'Four response options appear, each kind in the same place every time: a friendly answer, a polite no, a new direction, and a way to ask what they meant.',
                'While the user reads, the app can say a short phrase like “I’m thinking about that,” so the other person knows a reply is coming. The user can change these phrases or turn them off.',
                'The user taps an option, and the app says it in the voice they chose.']),
            p('The app never says a reply until the user taps it. If the other person offers a choice, such as “coffee or tea?”, the options become those choices. '
              'If they start to say goodbye, the options become goodbyes.'),
            p(f'Watch: {a("v23", "Your First Real Conversation")}.'),
        ]),
        ('What if none of the options fit?', 'none-fit', [
            ul(['<strong>“New 4”</strong> asks for a different set of options.',
                '<strong>The Express Panel</strong> holds the user’s saved words and phrases. One tap says one.',
                '<strong>“In my own words”</strong> opens a keyboard, and “Speak” says what the user typed, word for word.',
                '<strong>“Reframe”</strong> gives the typed words to the AI instead of speaking them, and the AI writes new options around them. The AI treats what the user types as true.']),
            p(f'Watch: {a("v25", "In Your Own Words")}.'),
        ]),
        ('Will it sound like the user?', 'sound-like', [
            p('It tries to, but it won’t always use the user’s exact words. '
              'The AI draws on the user’s About Me answers, the people and places they add, the replies they pick, and the sentences they type.'),
            p('When a reply didn’t sound right, the user can rewrite it later in Conversation Review. Rewriting several turns with the same person does the most.'),
            p('Our tests so far used made-up people, not real users. In those tests, About Me helped mostly with facts and reasons, and less with wording. '
              'We haven’t yet measured this with real users.'),
            p(f'Watch: {a("v310", "Looking Back at a Conversation")}.'),
        ]),
        ('What won’t the response options say?', 'guardrails', [
            p('The AI follows rules about what it may suggest. It won’t:'),
            ul(['make up events or personal details',
                'answer general-knowledge questions for the user, unless the user has listed that subject in About Me as one they know well',
                'answer for the user about pain or other symptoms',
                'swear',
                'take sides on faith or politics',
                'joke, unless the user has said jokes are welcome']),
            p('None of this limits what the user can say. Anything they type and “Speak”, or put on a button, comes out exactly as they wrote it. '
              'That includes hard things. In an October 2026 test of twelve painful moments, such as “I don’t want to live anymore,” the AI refused nothing.'),
            p(f'The full list is in Response Option Guardrails, on the {a("docs", "documents page")}.'),
        ]),
        ('What if it mishears the other person?', 'mishears', [
            p('Mistakes are most likely with names, unusual words, a noisy room or an unfamiliar accent. The app always shows what it heard, so the user can see them. '
              'If something important is wrong, “Ask them to repeat” asks the other person to say it again.'),
            p('The app is built for talking with one person. If several people talk, it runs their words together.'),
            p(f'Watch: {a("v24", "When It Hears Wrong")}.'),
        ]),
        ('Can the user practice first?', 'practice', [
            p('Yes. In Practice Mode the AI plays the other person, and the microphone stays off. '
              'The app comes with six scenarios: a tour of the buttons, plus practical, social, medical, personal and professional situations.'),
            p('The user can change these or write new ones, such as a doctor’s visit coming up next week. A therapist can write one and send it as a file. '
              'Practice uses the AI, so it has the same kind of small cost as a real conversation.'),
            p(f'Watch: {a("v22", "A Practice Conversation")}.'),
        ]),
    ]),
    ('Getting Set Up', [
        ('Which devices does it run on?', 'devices', [
            p('Conversant runs in a web browser, so there’s nothing to get from an app store.'),
            ul(['<strong>Windows computer or tablet, Chromebook or Mac:</strong> Chrome or Edge.',
                '<strong>iPad:</strong> Safari, on iPadOS 17 or later. Chrome and Edge on an iPad can’t hear the other person.',
                '<strong>Android phone or tablet:</strong> Chrome.',
                '<strong>iPhone:</strong> not supported.']),
            p('On an iPad we strongly recommend installing Conversant on the Home Screen. In Safari, the iPad can delete the app’s data after about a week without use. '
              'The trade-off is that a Home Screen install needs a paid speech service to hear the other person.'),
            p(f'Watch: {a("v12", "Installing Conversant")}.'),
        ]),
        ('What’s needed to get started?', 'get-started', [
            ul(['A supported device. Its built-in microphone and speaker are fine.',
                'An internet connection.',
                f'An AI key from Anthropic, the company behind the Claude AI. It’s a pay-as-you-go account, separate from a Claude.ai subscription, and it needs about $5 of starting credit. Watch: {a("v13", "Adding Your AI Key")}.',
                f'On a computer or Android device, a folder for the app’s data. Watch: {a("v14", "Keeping Your Information Safe")}.',
                'On an Android device or an iPad Home Screen install, a speech service. See “When is a paid speech service needed?”']),
            p('<em>During the beta, we give each tester an AI key and cover its cost, and we set up any speech service with you.</em>'),
        ]),
        ('Will eye gaze, switches and keyguards work?', 'access', [
            ul(['<strong>Eye gaze and head tracking:</strong> these work on a computer when the equipment moves the pointer and selects by dwelling. They haven’t been tried on an iPad or Android device yet. Use one tap in the app’s “One tap or two” setting, and set the dwell time on the tracker.',
                '<strong>A finger, stylus, mouse or trackball:</strong> these all work.',
                '<strong>Switch scanning:</strong> not available yet.',
                f'<strong>Keyguards:</strong> nothing on the screen moves, so one keyguard fits every screen and color scheme. “Generate Screen Openings”, on the Keyguard Design tab of Settings, writes out where the openings go. Watch: {a("v46", "Keyguards")}.']),
        ]),
        ('Does it work without the internet?', 'offline', [
            p('Partly. With no connection, the app can’t hear the other person and can’t offer response options. '
              'The user can still speak with the Express Panel and “In my own words”, in the device’s own voice if the paid voice can’t be reached.'),
            p('If only the AI is out of reach, the app still shows what the other person said.'),
        ]),
    ]),
    ('Costs', [
        ('What does it cost?', 'cost', [
            p('The app is free, with no subscription. The user pays the AI company directly for what they use.'),
            p('In our September 2026 test, each set of response options cost about half a cent. The app may write more than one set in a turn, because it refreshes the options when the other person pauses and goes on. '
              'Settings → About shows a running total.'),
            p('Express Panel buttons, typing and the short holding phrases don’t use the AI at all.'),
            p(f'Keeping Costs Down, on the {a("docs", "documents page")}, has more.'),
        ]),
        ('When is a paid speech service needed?', 'speech', [
            ul(['<strong>To hear the other person:</strong> Windows, Chromebook, Mac and an iPad in Safari do this for free. An iPad Home Screen install needs a paid service. Android’s free hearing drops words, so plan on a paid service there too.',
                '<strong>To speak:</strong> the device’s own voices are free. A paid voice sounds better, and most iPad users will want one, because the iPad’s own choice is narrow.']),
            p('The app works with four services. We recommend Microsoft Azure, and it also offers Google Cloud, Deepgram and ElevenLabs. One account and key covers both jobs.'),
            p('Azure’s free plan includes five hours of hearing and 500,000 characters of speaking every month, and sign-up asks for a credit card. '
              'Beyond free allowances, the services cost roughly 22 cents to $1 an hour for hearing, counting only the time someone is talking, and roughly 2 to 8 cents per 1,000 characters for speaking.'),
            p(f'Watch: {a("v15", "Do You Need a Speech Service?")} The Speech Provider Guide, on the {a("docs", "documents page")}, compares the services.'),
        ]),
    ]),
    ('Privacy and Your Information', [
        ('Who can see the conversations?', 'who-sees', [
            p('Conversant has no server, and the user has no account with us. Saved conversations stay on the user’s device. Some things do leave it:'),
            ul(['<strong>The AI company</strong> receives the conversation so far and what’s in About Me, so it can write the options.',
                '<strong>A speech service</strong>, either the browser’s own or a paid one, receives the sound of the other person talking.',
                '<strong>A cloud service</strong> receives copies if the data folder sits inside OneDrive, Google Drive, iCloud or Dropbox.']),
            p('The user controls some of this:'),
            ul(['<strong>“Don’t save this conversation”</strong> keeps a conversation off the device, and pressing it partway through deletes what was saved. The AI still receives it, because that’s how the options are written.',
                '<strong>“Prefer not to say”</strong> keeps an About Me answer from the AI altogether.',
                '<strong>A problem report</strong> includes a conversation, but goes only after the user reads it and chooses to send it.']),
            p('The app doesn’t encrypt what it stores, and its settings aren’t locked. The device’s passcode is the real lock.'),
            p('<em>During the beta, the app sends us a weekly report of counts and timings, with no words anyone said. Testers can turn it off. After the beta it’s off unless the user turns it on.</em>'),
            p(f'Your Security and Privacy, on the {a("docs", "documents page")}, has the details.'),
        ]),
        ('Is the other person being recorded?', 'partner', [
            p('The sound isn’t saved. An online service turns it into text, and the app keeps those words with the saved conversation on the user’s device. The words also go to the AI.'),
            p('The other person doesn’t need an app, training or any special knowledge. The app can’t ask for their agreement, so telling them is up to the user. '
              'An Express Panel button says “My device listens and speaks for me” with one tap, and a short chime plays when listening starts.'),
            p(f'Recording laws differ from place to place, and we can’t give legal advice. Partner Privacy, on the {a("docs", "documents page")}, covers what we’ve decided and why.'),
        ]),
        ('How is the user’s information backed up?', 'backup', [
            p('“Backup settings”, in Settings, writes one file holding About Me, people, places, the Express Panel, conversations, sounds and settings. “Import settings…” puts it back or moves it to another device. '
              'API keys are never in a backup, so they’re entered again on a new device.'),
            p('On a computer or Android device, the data folder is an ordinary folder, and it can be copied as well. On an iPad, the backup file is the only way to keep a copy, so make one regularly.'),
            p(f'Watch: {a("v52", "Backups and Moving to a New Device")}.'),
        ]),
    ]),
    ('Help and Support', [
        ('How can family or a therapist help?', 'helpers', [
            p('A helper can sit with the user to answer About Me, add people and places, fill Express Panel buttons, fit a keyguard, or write a practice scenario. '
              'What goes in, and what’s said, stays the user’s choice.'),
        ]),
        ('Who makes it, and who can help?', 'contact', [
            p('Conversant AAC is a free and open source project from Volksswitch.'),
            ul([f'<strong>Something went wrong?</strong> Check the {a("issues", "known issues")}, then use Settings → Troubleshooting → “Report a problem”. Watch: {a("v51", "Telling Us About a Problem")}.',
                f'<strong>Learning the app?</strong> See the {a("videos", "how-to videos")} and the {a("docs", "documents")}, which include a user manual for each kind of device.',
                f'<strong>Anything else?</strong> Email {a("email", "ken@volksswitch.org")}.']),
        ]),
    ]),
]


def build():
    blocks = [p('Short answers for AAC users, families and therapists. Here, “the user” is the person who uses AAC, and “the other person” is whoever they’re talking with.')]
    blocks.append(ul([f'<a href="#{anchor}">{q}</a>' for _, items in FAQ for q, anchor, _ in items]))
    for group, items in FAQ:
        blocks.append(h2(group))
        for q, anchor, body in items:
            blocks.append(h3(q, anchor))
            blocks.extend(body)
    return '\n\n'.join(blocks)


def main():
    if '--apply' not in sys.argv:
        sys.stdout.reconfigure(encoding='utf-8')
        print(re.sub(r'<!--.*?-->', '', build(), flags=re.S))
        print(f'\n{sum(len(i) for _, i in FAQ)} questions (dry run - add --apply to create the draft)')
        return
    from wp import call
    existing = call('GET', f'/wp/v2/pages?slug={SLUG}&status=publish,draft,private,pending,future&_fields=id,link')
    if existing:
        sys.exit(f'STOPPING - a page with the address "{SLUG}" already exists ({existing[0]["link"]}). '
                 'It is the copy now; edit it in WordPress.')
    page = call('POST', '/wp/v2/pages', {'title': TITLE, 'slug': SLUG, 'status': 'draft', 'content': build()})
    print(f'Draft created: page {page["id"]}, status {page["status"]}, preview {page["link"]}')


if __name__ == '__main__':
    main()
