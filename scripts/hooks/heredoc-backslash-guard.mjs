#!/usr/bin/env node
/*
 * A guard on Claude's own shell commands, run by Claude Code before every Bash command
 * (.claude/settings.json, a PreToolUse hook). Not part of the app; nothing deploys it.
 *
 * WHY IT EXISTS (Ken, November 23 2026: "This happens every time but continues to come
 * as a surprise"). Text written into a file through a shell heredoc passes through the
 * shell, and then through whatever program reads it (Python, Node), and either can
 * rewrite a backslash sequence on the way. On November 23 2026 a backslash-n meant for a
 * JavaScript string arrived as a real line break and broke two string literals; in
 * September a backslash-b became a backspace character and silently disabled a regex
 * (CLAUDE.md, the document tooling section). The rule was written down - "content
 * containing a backslash goes through the Write tool, never a heredoc" - and kept being
 * broken, so it is now refused rather than remembered.
 *
 * THE RULE: a Bash command with a heredoc (<<) and a backslash anywhere after it is
 * refused. That also refuses a heredoc that only READS with a backslash in it (a regex
 * in a quick Python check, say), which costs writing the script to the scratchpad with
 * the Write tool and running the file. The alternative, a rule clever enough to tell
 * reading from writing, is the kind that lets the next mistake through.
 *
 * Exit 2 refuses the command and hands the message on stderr to Claude. Exit 0 lets it
 * run. Anything unexpected here (input it cannot read) lets the command run, so a broken
 * guard can never stop all work.
 */

const BACKSLASH = String.fromCharCode(92);   // spelled this way so nothing can rewrite it

export function refuses(command) {
    const s = String(command || '');
    const at = s.indexOf('<<');
    return at >= 0 && s.indexOf(BACKSLASH, at) >= 0;
}

const MESSAGE = [
    'Refused by the heredoc guard (scripts/hooks/heredoc-backslash-guard.mjs, wired in .claude/settings.json):',
    'this command has a heredoc (<<) with a backslash after it.',
    'The shell and the program reading the heredoc can rewrite backslash sequences: on November 23 2026 a',
    'backslash-n meant for a JavaScript string arrived as a real line break.',
    'Write file content with the Write or Edit tool instead. To run a script that needs backslashes, write it',
    'to the scratchpad with the Write tool and run the file. For a commit message with a backslash in it,',
    'write the message to a file and use git commit -F <file>.',
].join('\n');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    let call;
    try { call = JSON.parse(input); } catch { process.exit(0); }
    const command = call && call.tool_input && call.tool_input.command;
    if (call && call.tool_name === 'Bash' && refuses(command)) {
        process.stderr.write(MESSAGE + '\n');
        process.exit(2);
    }
    process.exit(0);
});
