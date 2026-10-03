/* Re-reading the user's conversations into the voice profile.
 *
 * ONE place, used by About Me's "Read my conversations" button and by Conversation
 * Review when the user leaves a review or asks what it taught the app. Two copies of
 * the classification lists below would drift, and a turn misclassified as composed
 * puts OUR words in the user's mouth in the prompt.
 */

import * as storage from './storage.js';
import * as voiceProfile from './voice.js';
import * as voiceHarvest from './voice-harvest.js';
import * as controlPhrases from './control-phrases.js';
import * as placeholderPhrases from './placeholder-phrases.js';
import * as expressPanel from './express-panel.js';

/**
 * Read every saved conversation (with its review, where there is one) and store what
 * the harvest concludes. Returns the result, or null with no data folder or nothing
 * readable. Never throws.
 */
export async function refreshVoiceHarvest() {
    try {
        const logs = await storage.listConversationLogs();
        const result = voiceHarvest.harvest(logs, {
            // Needed to classify turns written before the source field existed: our
            // own control phrases and the user's Express labels must not be mistaken
            // for prose they composed. The placeholders join them: they are equally
            // OUR words, and harvesting one as an example of how this person talks
            // would be teaching the model its own stalling back to itself.
            controlPhrases: [...controlPhrases.allPhrases(), ...placeholderPhrases.allPhrases()],
            expressPhrases: expressPanel.allItems()
                .filter((i) => i.type === 'phrase' && i.text).map((i) => i.text),
        });
        await voiceProfile.setHarvest(result);
        return result;
    } catch {
        return null;
    }
}
