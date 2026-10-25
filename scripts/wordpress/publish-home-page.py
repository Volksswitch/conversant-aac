"""Publish the Conversant AAC home page on volksswitch.org, once.

The page is shared only with beta testers (through the welcome email) and is not
linked from any other page on the site. Its reviewed draft is
Documents/Conversant AAC Website Home Page.docx (generator
scripts/doc-generators/generate-home-page-doc.js); the text below matches that draft
with the reviewer notes and the "[Beta: remove at public release]" markers left out.

ONCE PUBLISHED, THE WORDPRESS PAGE IS THE COPY. Ken edits it in WordPress, so this
script refuses to run if a page with the slug already exists - running it again would
overwrite his edits. Change the page in WordPress, or pull it with the approach in
known-issues.py.

Run: python scripts/wordpress/publish-home-page.py            (shows what it would do)
     python scripts/wordpress/publish-home-page.py --apply    (uploads and publishes)
"""
import os, sys, html
sys.path.insert(0, os.path.dirname(__file__))
from wp import call

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PICTURE = os.path.join(ROOT, 'Other', 'Web Pages', 'conversant-home-screen.png')
SLUG = 'conversant'
TITLE = 'Conversant AAC'
MEDIA_FOLDER = 101   # Conversant AAC

SITE = 'https://volksswitch.org/index.php/'
U = {
    'app': 'https://conversant.volksswitch.org/',
    'beta': SITE + 'conversant-beta/',
    'videos': SITE + 'conversant-videos/',
    'v11': SITE + 'conversant-videos/video-1-1/',
    'v13': SITE + 'conversant-videos/video-1-3/',
    'v16': SITE + 'conversant-videos/video-1-6/',
    'v51': SITE + 'conversant-videos/video-5-1/',
    'docs': SITE + 'conversant-documents/',
    'issues': SITE + 'conversant-aac-known-issues/',
    'email': 'mailto:ken@volksswitch.org',
}


def a(key, text):
    return f'<a href="{html.escape(U[key])}">{text}</a>'


def p(text):
    return f'<!-- wp:paragraph -->\n<p>{text}</p>\n<!-- /wp:paragraph -->'


def h2(text):
    return f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{text}</h2>\n<!-- /wp:heading -->'


def ul(items):
    li = ''.join(f'<!-- wp:list-item -->\n<li>{i}</li>\n<!-- /wp:list-item -->' for i in items)
    return f'<!-- wp:list -->\n<ul class="wp-block-list">{li}</ul>\n<!-- /wp:list -->'


def ol(items):
    li = ''.join(f'<!-- wp:list-item -->\n<li>{i}</li>\n<!-- /wp:list-item -->' for i in items)
    return f'<!-- wp:list {{"ordered":true}} -->\n<ol class="wp-block-list">{li}</ol>\n<!-- /wp:list -->'


def buttons(pairs):
    b = ''.join(f'<!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" '
                f'href="{html.escape(U[k])}">{t}</a></div>\n<!-- /wp:button -->' for k, t in pairs)
    return f'<!-- wp:buttons -->\n<div class="wp-block-buttons">{b}</div>\n<!-- /wp:buttons -->'


def image(media):
    return (f'<!-- wp:image {{"id":{media["id"]},"sizeSlug":"large","linkDestination":"none"}} -->\n'
            f'<figure class="wp-block-image size-large"><img src="{html.escape(media["url"])}" '
            f'alt="The Conversant screen during a conversation, with four response options showing" '
            f'class="wp-image-{media["id"]}"/></figure>\n<!-- /wp:image -->')


def build(media):
    return '\n\n'.join([
        p('<em>From communication to conversation</em>'),
        p('Conversant AAC is a free app that helps people who use AAC keep up in a real conversation. '
          'It listens to the other person, offers four ways to reply within a few seconds, and says the one the user taps.'),
        buttons([('app', 'Open Conversant'), ('v11', 'Watch: What Conversant Is For (1 minute)')]),
        image(media),
        h2('Thank You for Testing It'),
        p('Conversant is in beta, and you’re one of a small group of people trying it before anyone else. '
          'What you tell us decides what we fix and what we build next.'),
        ul([f'<strong>Start with the videos.</strong> The {a("videos", "how-to videos")} walk you through setting up and your first conversations, a few minutes at a time.',
            f'<strong>Tell us when something goes wrong.</strong> Conversant can send us a problem report in a couple of taps. The video {a("v51", "“Telling Us About a Problem”")} shows how.',
            f'<strong>Check the known issues.</strong> The {a("issues", "known issues")} page lists problems we already know about and how to work around them.',
            f'<strong>Know someone who might like to try it?</strong> {a("beta", "Tell us about them")}, and we’ll write to them.']),
        h2('How It Works'),
        ol(['The other person talks. Conversant listens and shows what it heard, so the user can check it.',
            'A few seconds later, four response options appear: a friendly answer, a polite way to say no, a way to take the conversation somewhere new, and a way to ask what they meant.',
            'The user taps one, and Conversant says it out loud in the voice they’ve chosen.']),
        p('If none of the four fit, the user can type their own words or tap a phrase they’ve saved. While they read the options, '
          'Conversant can say a short phrase like “I’m thinking about that,” so the other person knows a reply is coming.'),
        p('The other person doesn’t need anything: no app, no training and no special knowledge.'),
        h2('The Problem It Solves'),
        p('Most AAC devices are built to get a message across: a need, a choice, a piece of information. '
          'Conversation asks for more than that. A reply has to come while it still fits.'),
        p('People start to feel uncomfortable after one to four seconds of silence. After that they finish the sentence for the AAC user, '
          'change the subject or move on. Building a full reply on most devices takes much longer, so many AAC users end up answering '
          'questions instead of taking part. Conversant puts a reply in front of the user within that window.'),
        h2('What Makes It Different'),
        ul(['<strong>It speaks as the user.</strong> Conversant shapes its options around what the user has told it about themselves, the people in their life and the places they go. Nothing is said until the user taps it.',
            '<strong>It doesn’t put words in the user’s mouth.</strong> It won’t answer for the user with facts they never gave it, such as a date in history or an allergy that isn’t on file. It offers what a person would say instead: that they don’t know, or a question back.',
            '<strong>Nothing on the screen moves.</strong> Every button stays where it is, so the user can learn where things are, and one keyguard fits every screen.',
            '<strong>It works with many ways of pointing.</strong> A finger, a stylus, a mouse or a trackball all work, and so do eye gaze and head tracking set up to move the pointer.',
            '<strong>It keeps working without the AI.</strong> If the AI can’t be reached, saved phrases and typing still work, and the user can still see what the other person said.',
            '<strong>There’s a practice mode.</strong> The AI plays the other person, so the user can rehearse before a conversation that matters, like a doctor’s appointment.',
            '<strong>It’s private.</strong> The user’s information stays on their own device. Only what’s needed to suggest replies goes to the AI company.',
            '<strong>It’s free and open source.</strong> There’s no subscription and no license, and anyone is welcome to take it and build on it. Users pay the AI company directly for what they use, usually a fraction of a cent per reply.']),
        h2('Who It’s For Right Now'),
        p('The first version is designed for someone who:'),
        ul(['is 18 or older and makes their own decisions',
            'can read the options on the screen',
            'points at the screen directly, in any of the ways listed above',
            'has an iPad, an Android phone or tablet, or a Windows computer or tablet, Chromebook or Mac']),
        p('Switch scanning, younger users and people at other reading levels are part of the plan for later versions.'),
        h2('What You Need'),
        ul(['A supported device with a current web browser. There’s nothing to download from an app store.',
            'An internet connection.',
            f'An AI key, which lets Conversant ask an AI company for response options. The video {a("v13", "“Adding Your AI Key”")} shows where it goes.',
            'During the beta, we give you the AI key and cover its cost.',
            'On an Android device, or an iPad with Conversant on the Home Screen, a speech service so the app can hear the other person. '
            'During the beta we set this up with you, using Deepgram, and the free credit that comes with it should last the whole beta. '
            f'Afterward you can keep Deepgram or switch to Microsoft Azure, the service we recommend. The video {a("v16", "“Adding Your Deepgram Key”")} shows where the key goes.']),
        h2('Learn More'),
        ul([f'<strong>{a("videos", "How-to videos")}</strong>. Short videos, from installing Conversant to your first conversation and beyond.',
            f'<strong>{a("docs", "Documents")}</strong>. The Product Overview, a user manual for each kind of device, and guides to privacy, costs and speech services.',
            f'<strong>{a("issues", "Known issues")}</strong>. Problems we know about, and how to work around them.',
            f'<strong>{a("email", "Email Ken")}</strong> at ken@volksswitch.org with questions, ideas or anything else.']),
        p('Conversant AAC is a Volksswitch project.'),
    ])


def main():
    apply = '--apply' in sys.argv
    existing = call('GET', f'/wp/v2/pages?slug={SLUG}&status=publish,draft,private,pending,future&_fields=id,link')
    if existing:
        sys.exit(f'STOPPING - a page with the address "{SLUG}" already exists ({existing[0]["link"]}). '
                 'It is the copy now; edit it in WordPress.')
    if not apply:
        print(build({'id': 0, 'url': 'PICTURE'}))
        print('\n(dry run - add --apply to upload the picture and publish)')
        return
    boundary = 'ConversantBoundary7f3a9c'
    with open(PICTURE, 'rb') as f:
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                f'filename="conversant-home-screen.png"\r\nContent-Type: image/png\r\n\r\n'
                ).encode() + f.read() + f'\r\n--{boundary}--\r\n'.encode()
    media = call('POST', '/wp/v2/media', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    call('POST', f'/wp/v2/media/{media["id"]}', {
        'title': 'Conversant AAC home page: the conversation screen', 'media_folder': [MEDIA_FOLDER],
        'alt_text': 'The Conversant screen during a conversation, with four response options showing'})
    up = {'id': media['id'], 'url': media['source_url']}
    page = call('POST', '/wp/v2/pages', {'title': TITLE, 'slug': SLUG, 'status': 'publish', 'content': build(up)})
    print(f'Published {page["link"]} (page {page["id"]}); picture is media {up["id"]}')


if __name__ == '__main__':
    main()
