let recognition = null;
let onTranscript = null;
let onSilencePeriod = null;
let onStatusChange = null;
let accumulatedText = '';
let currentInterim = '';
let silenceTimer = null;
let silenceThreshold = 2000;
let listeningIntent = false;

export function isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function setSilenceThreshold(seconds) {
    silenceThreshold = seconds * 1000;
}

export function init({ onResult, onSilence, onStatus }) {
    onTranscript = onResult;
    onSilencePeriod = onSilence;
    onStatusChange = onStatus;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let latestInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                accumulatedText += transcript;
                latestInterim = '';
            } else {
                latestInterim = transcript;
            }
        }
        currentInterim = latestInterim;
        resetSilenceTimer();

        if (onTranscript) onTranscript((accumulatedText + currentInterim).trim());
    };

    recognition.onend = () => {
        // A silence period no longer ends recording. While the user still
        // intends to listen, the browser may stop continuous recognition on
        // its own (e.g. after a pause) — restart it so the partner's floor
        // stays open across silences. accumulatedText persists across restarts.
        if (listeningIntent) {
            currentInterim = '';
            try { recognition.start(); } catch { /* already starting */ }
            return;
        }
        clearSilenceTimer();
        if (onStatusChange) onStatusChange('stopped');
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (onStatusChange) onStatusChange('error', event.error);
    };
}

function resetSilenceTimer() {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
        // The partner has gone quiet for the silence period. Hand the speech
        // collected so far to the app for response generation, but keep
        // recording — if the partner resumes, the next silence period will
        // fire again with the combined speech.
        const text = (accumulatedText + currentInterim).trim();
        if (text && onSilencePeriod) onSilencePeriod(text);
    }, silenceThreshold);
}

function clearSilenceTimer() {
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
}

export function startListening() {
    if (!recognition) return;
    accumulatedText = '';
    currentInterim = '';
    listeningIntent = true;
    try { recognition.start(); } catch { /* already started */ }
    if (onStatusChange) onStatusChange('listening');
}

export function stopListening() {
    if (!recognition) return;
    listeningIntent = false;
    clearSilenceTimer();
    recognition.stop();
}

// Discard the speech collected so far without stopping recording. Used when the
// user asks the partner to repeat — the current exchange's text is thrown away
// and the system keeps listening for the partner's restated utterance.
export function resetTranscript() {
    accumulatedText = '';
    currentInterim = '';
    clearSilenceTimer();
}
