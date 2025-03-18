import { PromiseChain } from "./usefull-funcs.js";
import * as FB from "../Firebase/firebase.js";

let UTTERANCES = {};
let VOICE_NAME = "charles";

const synth = window.speechSynthesis;
const speachQueue = new PromiseChain()

function parseUtterance(str) {
    if (typeof str !== "string") {
        throw `Utterance "${str}" not of type string.`
    } else {
        str = str.trim().toLocaleLowerCase();
        if (str.length == 0) {
            throw 'Empty utterance.'
        }
    }
    return str;
}

function defaultData(phrases) {
    const data = {errors: [], utterances: {}}
    phrases.forEach(element => {
        data.utterances[element] = {url: "default"}
    });
    return data;
}

async function playUtterance(utterance) {
    let url = await getUtteranceURL(utterance);

    if (url === "default") {
        await playUtteranceDefault(utterance);
    } else {
        await playAudioURL(url);
    }
}


async function playAudioURL(url) {
    const audio = new Audio(url);
    return new Promise((resolve, reject) => {
        audio.onerror = resolve
        audio.onended = resolve
        audio.play();
    });
}


async function playUtteranceDefault(phrase) {

    const utterThis = new SpeechSynthesisUtterance(phrase);
    // const selectedOption = voiceSelect.selectedOptions[0].getAttribute("data-name");
    // for (let i = 0; i < voices.length; i++) {
    //     if (voices[i].name === selectedOption) {
    //     utterThis.voice = voices[i];
    //     }
    // }
    return new Promise((resolve, reject) => {
        utterThis.onerror = resolve;
        utterThis.onend = resolve;
        synth.speak(utterThis);
    })
}

/** 
 * @param {string}  utterance
 * @return {Promise<string>} url of utterance mp3 file
*/
export async function getUtteranceURL(utterance){
    const utt = parseUtterance(utterance);
    let url = null;

    if (VOICE_NAME in UTTERANCES && utt in UTTERANCES[VOICE_NAME]) {
        let utterance = UTTERANCES[VOICE_NAME][utt];
        if (utterance instanceof Promise) await utterance;
        url = UTTERANCES[VOICE_NAME][utt].url
    }

    return url;
}


/** @param {string} voiceName */
export async function changeVoice(voiceName) {
    const old = VOICE_NAME in UTTERANCES ? UTTERANCES[VOICE_NAME] : {};
    const oldPhrases = Object.keys(old);

    const newp = voiceName in UTTERANCES ? UTTERANCES[voiceName] : {};
    const newPhrases = new Set(Object.keys(newp));

    const notLoaded = oldPhrases.filter(p => !newPhrases.has(p));

    await loadUtterances(notLoaded, voiceName);

    VOICE_NAME = voiceName;
}

/**
 * Load utterances for a given topic
 * @param {string[]} utterances
 * @return {Promise<void>}
 */
export async function loadUtterances(utterances){
    if (!(VOICE_NAME in UTTERANCES)) UTTERANCES[VOICE_NAME] = {};
    const uttLib = UTTERANCES[VOICE_NAME]

    

    const phrases = utterances.map(parseUtterance).filter(p => !(p in uttLib));

    if (phrases.length > 0) {
        let data;
        if (VOICE_NAME !== "default") {
            const prom = FB.callFunction("utterances-get", {phrases, voiceName: VOICE_NAME});
            
            // Store promise 
            phrases.forEach(p => uttLib[p] = prom);
        
            data = (await prom).data;
        } else {
            data = defaultData(phrases);
        }

        // Store utterances locally
        if (data.errors.length == 0) {
            for (let key in data.utterances) {
                uttLib[key] = data.utterances[key];
            }
        }
    }
}

/**
 * @param {string}
 */
export async function speak(utterance) {
    
    await speachQueue.addPromise(() => playUtterance(utterance))
}

