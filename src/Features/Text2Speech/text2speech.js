import { PromiseChain } from "../../Utilities/usefull-funcs.js";
import * as FB from "../../Firebase/firebase.js";
import { Features } from "../features-interface.js";
import { getSelectedDevice } from "../../Utilities/device-manager.js";

const DEBUG = true;
const cmodes = {
    "normal": ["rgb(214, 109, 22)", "rgb(183, 61, 17)"],
    "load": ["rgb(64, 195, 21)", "rgb(14, 127, 31)"]
}
function log(main, list, mode = "normal") {
    if (!DEBUG) return;
    let[ c1, c2] = cmodes[mode] || cmodes["normal"];
    let n = Array.isArray(list) ? list.length : 0;
    list = Array.isArray(list) ? [main, "%c\n", ...list.map(t => "%c" + t)] : [main];
    main = list.join(" ");
    let list2 = Array.isArray(list) ? ["color:white;background:transparent;", ...new Array(n).fill(`color: white; background-color: ${c2}; padding: 5px; border-radius: 5px; margin: 2px;`)]  : [];
    console.log("%cText2Speech: " + main, `background-color:${c1}; color: white; padding: 5px; border-radius: 5px;`, ...list2);
}
let UTTERANCES = {};
let VOICE_NAME = "charles";
let VOLUME = 1;
const MY_VOICES = {
    margaret: true,
    jane: true,
    peter: true,
    charles: true,
    sarah: true,
    lachlan: true,
    jeffrey: true,
    theo: true,
    lucy: true,
    holly: true,
    default: true
}


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

async function playUtterance(utterance, isName) {
    let url = await getUtteranceURL(utterance, isName);
    if (url === "default") {
        await playUtteranceDefault(utterance);
    } else {
        await playAudioURL(url);
    }
}


async function playAudioURL(url) {
    const audio = new Audio(url);
    audio.volume = VOLUME;
    let sinkID = await getSelectedDevice("audiooutput");
    audio.setSinkId(sinkID);
    return new Promise((resolve, reject) => {
        audio.onerror = resolve
        audio.onended = resolve
        audio.play();
    });
}

async function playUtteranceDefault(phrase) {
    const utterThis = new SpeechSynthesisUtterance(phrase);
    utterThis.volume = VOLUME;
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
async function getUtteranceURL(utterance, isName) {
    const utt = parseUtterance(utterance);
    let url = null;

    let voiceName = VOICE_NAME;
    if (isName == true && utt in MY_VOICES) {
        voiceName = utt;
    }

    if (voiceName in UTTERANCES && utt in UTTERANCES[voiceName]) {
        let utterance = UTTERANCES[voiceName][utt];
        if (utterance instanceof Promise) await utterance;
        url = UTTERANCES[voiceName][utt].url
    }

    return url;
}


/** @param {string} voiceName */
async function changeVoice(voiceName) {

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
 * @param {string} voiceName
 * @return {Promise<void>}
 */
async function loadUtterances(utterances, voiceName = VOICE_NAME){
    if (!(voiceName in UTTERANCES)) UTTERANCES[voiceName] = {};
    const uttLib = UTTERANCES[voiceName]

    const phrases = utterances.map(parseUtterance).filter(p => !(p in uttLib));

    if (phrases.length > 0) {
        let data;
        if (voiceName !== "default") {
            log(`Loading ${phrases.length} utterances for voice = '${voiceName}'`, phrases);
            const prom = FB.callFunction("utterances-get", {phrases, voiceName});
            
            // Store promise 
            phrases.forEach(p => uttLib[p] = prom);
        
            data = (await prom).data;
            
        } else {
            data = defaultData(phrases);
        }

        // Store utterances locally
        if (data.errors.length == 0) {
            log(`Loaded ${phrases.length} utterances for voice = '${voiceName}' ✅`, phrases, "load");
            for (let key in data.utterances) {
                uttLib[key] = data.utterances[key];
            }
        } else {
            log(`Errors loading ${phrases.length} utterances for voice = '${voiceName}' ❌`);
            console.error("Text2Speech: Errors loading utterances:", data.errors);
        }
    }
}

/**
 * @param {string}
 */
async function speak(utterance, isName, override = false) {
    await speachQueue.addPromise(() => playUtterance(utterance, isName), override)
}

class InvalidUtterance extends Error {
    constructor(){
        super("Text2Speech: Utterance must be string")
    }
}

export class Text2Speech extends Features {
    constructor(session, sdata) {
        super(session, sdata);
    }

    /** Loads an utterance if not already loaded, stores it
     *  and returns the url to the audio file.
     * @param {string}  utterance
     * @return {Promise<string>} url of utterance mp3 file
    */
    async getUtteranceURL(utterance) {
        return await getUtteranceURL(utterance);
    }

    /** Changes the speeking voice.
     *  @param {string} voiceName 
     * */
    async changeVoice(voiceName){
        if (!(voiceName in MY_VOICES)) {
            throw "Invalid voice name";
        }
        await changeVoice(voiceName);
        console.log("voice changed to " + voiceName);
        
    }

    /**
     * Loads a list of utterances and stores them for 
     * later use.
     * @param {string[]} utterances
     * @return {Promise<void>}
     */
    async loadUtterances(utterances) {
        if (Array.isArray(utterances)) {
            utterances = utterances.filter(u => typeof u === "string");
            return await loadUtterances(utterances);
        }
    }

    /**
     * Speaks a given utterance, if broadcast is set
     * true the speach will be broadcast to the other 
     * user in the session and spoken on their end as well.
     */
    async speak(utterance, broadcast = true) {
        utterance = parseUtterance(utterance);

        const {videoCall} = this.session;
        if (broadcast && videoCall) {
            videoCall.sendData("t2s", utterance)
        }

        await speak(utterance);
    }

    async speakName(utterance, broadcast = true) {
        utterance = parseUtterance(utterance);

        if (utterance in MY_VOICES) {
            const {videoCall} = this.session;
            if (broadcast && videoCall) {
                videoCall.sendData("t2s-name", utterance)
            }
    
            await speak(utterance, true, true);
        }
    }


    async initialise(){
        let names = Object.keys(MY_VOICES);
        await Promise.all(names.map(v => loadUtterances([v], v)));

        this.session.videoCall.addEventListener("t2s", (e) => {
            const {data} = e;
            if (typeof data === "string") {
                this.speak(data, false);
            } 
        })
        this.session.videoCall.addEventListener("t2s-name", (e) => {
            const {data} = e;
            if (typeof data === "string") {
                this.speakName(data, false);
            } 
        })

        let tempVoice = null;

        VOLUME = this.session.settings.get(`${this.sdata.me}/volume/level`) / 100;
        let voice = this.session.settings.get(`${this.sdata.me}/access/voice`);
        log("Initial voice = '" + voice + "' volume = " + VOLUME);

        this.session.settings.addEventListener("change", (e) => {
            let {user, group, setting, value} = e;
            if (user == this.sdata.me){
                if (group == "access" && setting == "voice") {
                    if (value in MY_VOICES && tempVoice !== value) {
                        tempVoice = value;
                        this.speakName(value, true);
                    }
                } else if (group == "volume" && setting == "level") {
                    VOLUME = value/100;
                }
            }
        })

        this.session.settings.addEventListener("exit", (e) => {
            if (tempVoice !== null) {
                changeVoice(tempVoice);
                tempVoice = null;
            }
        });

        
    }
}
