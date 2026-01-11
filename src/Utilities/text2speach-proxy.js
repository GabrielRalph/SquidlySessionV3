let Text2SpeechManager = {
    loadUtterances: async (texts) => {},
    speak: async (text) => {}
};

export function setText2SpeechManager(manager){
    Text2SpeechManager = manager;
}

export async function speak(text, broadcast) {
    return await Text2SpeechManager.speak(text, broadcast);
}

export async function loadUtterances(texts) {
    return Text2SpeechManager.loadUtterances(texts);
}