import { PromiseChain } from "../../Utilities/usefull-funcs.js";
import * as FB from "../../Firebase/firebase.js";
import { Features } from "../features-interface.js";
import { getSelectedDevice } from "../../Utilities/device-manager.js";
import { setText2SpeechManager } from "../../Utilities/text2speach-proxy.js";
const DEBUG = false;
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
let SPEED = 1;
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
    default: true,

    ফাতেমা: true,
    ফুয়াদ: true,
    রানী: true,
    প্রদীপ: true,

    다빈: true,
    소영: true,
    민재: true,
    병준: true,

    louis: true,
    amélie: true,
    etienne: true,
    julia: true
}
const SPEEDS = {
    slow: 0.8,
    medium: 1,
    fast: 1.25
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
    log(`Playing audio from URL: ${url}`, [], "load");
    
    const audio = new Audio(url);

    audio.playbackRate = SPEED

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

    if (!(voiceName in UTTERANCES)) {
        console.warn(`Text2Speech: Voice '${voiceName}' has no utterances loaded.`);
    } else if (!(utt in UTTERANCES[voiceName])) {
        console.warn(`Text2Speech: Utterance '${utt}' not found for voice '${voiceName}'`);
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

    log(`Changing voice to '${voiceName}'`, [], "load");
    const old = VOICE_NAME in UTTERANCES ? UTTERANCES[VOICE_NAME] : {};
    const oldPhrases = Object.keys(old);
    

    const newp = voiceName in UTTERANCES ? UTTERANCES[voiceName] : {};
    const newPhrases = new Set(Object.keys(newp));

    const notLoaded = oldPhrases.filter(p => !newPhrases.has(p));

    VOICE_NAME = voiceName;
    
    await loadUtterances(notLoaded, voiceName);
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

let bufferedUtterances = [];
setText2SpeechManager({
    speak: async () => {},
    loadUtterances: async (utterances) => {
        bufferedUtterances.push(...utterances);
    }
})


export default class Text2Speech extends Features {
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

        // Listen for speaking requests through webrtc
        this.session.videoCall.addEventListener("t2s", (e) => {
            const {data} = e;
            if (typeof data === "string") {
                this.speak(data, false);
            } 
        })

        // Listen for name speaking requests through webrtc
        this.session.videoCall.addEventListener("t2s-name", (e) => {
            const {data} = e;
            if (typeof data === "string") {
                this.speakName(data, false);
            } 
        })


        // Initial settings
        VOLUME = this.session.settings.get(`${this.sdata.me}/volume/level`) / 100;
        let voice = this.session.settings.get(`${this.sdata.me}/languages/voice`);
        log("Initial voice = '" + voice + "' volume = " + VOLUME);


        // Listen to settings changes 
        let tempVoice = null;
        this.session.settings.addEventListener("change", (e) => {
            const {user, group, setting, value} = e;

            // If the setting change petains to this user
            if (user == this.sdata.me){
                let isSettingsInLanguage = this.session.currentOpenFeature === "settings" && this.session.settings.openPath.endsWith("languages");

                // If the setting is in languages group
                if (group == "languages") {

                    // If the setting is voice
                    if (setting == "voice" && value in MY_VOICES && tempVoice !== value) {

                        // If the user is currently in the languages settings page
                        // then temporarily change the voice to the new one and speak
                        // the name of the voice.
                        if (isSettingsInLanguage) {
                            tempVoice = value;
                            this.speakName(value, true);

                        // Otherwise change the voice immediately
                        } else {
                            changeVoice(value)
                            tempVoice = null;
                        }

                    // If the setting is speed
                    } else if (setting == "speed") {
                        let newSpeed = SPEEDS[value] || 1;

                        // If speed has changed
                        if (newSpeed !== SPEED) {

                            // If the user is currently in the languages settings page
                            // speak the current voice name at the new speed
                            if (isSettingsInLanguage) {
                                this.speakName(tempVoice || VOICE_NAME, true);
                            }

                            // Change speed
                            SPEED = newSpeed;
                        }
                    }

                // If the setting is in volume group change the volume
                } else if (group == "volume" && setting == "level") {
                    VOLUME = value/100;
                } 
            }
        })

        // On exit of settings, if there is a temp voice, change to it
        this.session.settings.addEventListener("exit", (e) => {
            if (tempVoice !== null) {
                changeVoice(tempVoice);
                tempVoice = null;
            }
        });

        await changeVoice(voice);
       
        // Load buffered utterances
        this.loadUtterances(bufferedUtterances);

        // Set text2speech manager
        setText2SpeechManager({
            speak: async (utterance, broadcast) => {
                await this.speak(utterance, broadcast); 
            },
            loadUtterances: async (utterances) => {
                await this.loadUtterances(utterances);
            }
        });
    }


    static get name(){
        return "text2speech";
    }
}
