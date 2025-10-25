import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { get, set } from "../../Firebase/firebase.js";
import { relURL } from "../../Utilities/usefull-funcs.js";

/** @typedef {import("../squidly-session.js").SessionDataFrame} SessionDataFrame */

function getAllKeys(arr) {
    let keys = [];
    let r = (ri = 0, root = "") => { 
        if (ri >= arr.length)  {
            keys.push(root);
        } else {
            if (Array.isArray(arr[ri])) {
                for (let key of arr[ri]) {
                    r(ri + 1, (root ? root + "/" : "") + key);
                }
            } else if (typeof arr[ri] === "string") {
                r(ri + 1, (root ? root + "/" : "") + arr[ri]);
            }
        }
    }
    r(0, "");
   
    return keys;
}

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

const LANGUAGES = {
    english: {
        flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2Fv9IAQ4u0oMQkqwLwBpfr?alt=media&token=e7a320a0-90d6-4a55-8b26-2aaba96e4242",
        voices: {...MY_VOICES},
    },
    
    bengali: {
        flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2F4XFjZmzE6VPkl3EEMHGK?alt=media&token=47322a32-8141-4829-9d0f-ff80aefd3250",
        voices: {
            প্রদীপ: true,
            ফাতেমা: true,
            ফুয়াদ: true,
            রানী: true,
        },
    },

    french:{
        flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FydIUDFL35AfMi0BaxQvV?alt=media&token=be15e86c-4235-43b9-b9b7-2bad19cfe4bc",
        voices: {
            louis: true,
            amélie: true,
            etienne: true,
            julia: true
        },
    },

    // german:{
    //     flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2F26DRt7vVftf7T5D7GpEJ?alt=media&token=24709089-b738-440b-9577-f2882ad8a13c",
    //     voices: {
    //         hans: true,
    //         marlene: true,
    //         vicki: true,
    //         default: true
    //     },
    // },
    // italian:{
    //     flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FA3hluY0c8Qeh4bhQL4DB?alt=media&token=64ed09f8-06a3-4615-81bc-ca47e21e844c",
    //     voices: {
    //         carlo: true,
    //         francesca: true,
    //         alice: true,
    //         default: true
    //     }
    // },
    // spanish:{
    //     flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/images%2Fspain.svg?alt=media&token=e4d869d4-2e8c-4067-a3e4-69dc4fb0c61a",
    //     voices: {
    //         jorge: true,
    //         conchita: true,
    //         enrique: true,
    //         default: true
    //     }
    // },
    // mandarin:{
    //     flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FpXhLyYqu5BqGJaSHsj4q?alt=media&token=8fd2f8fd-02c7-4097-8c66-466c62336a92",
    //     voices: {
    //         liu: true,
    //         xiaoxiao: true,
    //         yunjian: true,
    //         default: true
    //     }
    // },
    // japanese:{
    //     flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FLfdtpK9UBjP1pFgi4NiM?alt=media&token=36aecef7-c043-4ea7-b822-8204d1a77890",
    //     voices: {
    //         takumi: true,
    //         haruka: true,
    //         kyoko: true,
    //         default: true
    //     }
    // },
    korean:{
        flag: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FPdXOuSWnLc1C9mIDyNcZ?alt=media&token=e0869cf1-f1aa-4fab-acf4-ef2cd9772e58",
        voices: {
            다빈: true,
            소영: true,
            민재: true,
            병준: true,
        }
    }
}



const SettingOptions = [
    {
        key: [["host", "participant"], "access", ["dwellTime", "switchTime"]],
        type: "number",
        default: 1,
        min: 0.5,
        max: 3,
        step: 0.1,
        toString(value){
            return Math.round(value * 10) / 10 + "";
        },
        toIcon({value, name}) {
            return {
                symbol: {text: this.toString(value) + "s"},
                displayValue: name.endsWith("dwellTime") ? "Eye Gaze" : "Switch",
            }
        }
    },
    {
        key: [["host", "participant"], "keyboardShortcuts", ["v", "a", "f", "c", "g", "x", "q", "s", "e"]],
        type: "boolean",
        default: false,
        toIcon({value, name}) {
            return {
                symbol: {url: relURL("../../Utilities/KeyboardIcons/" + name[name.length-1] + ".svg", import.meta)},
                active: value,
            }
        }
    },
    {
        key: [["host", "participant"], "eye-gaze-enabled"],
        type: "boolean",
        default: true,
        toIcon({value}) {
            return {
                symbol: value ? "eye" : "noeye",
                displayValue: value ? "Eye-gaze Enabled" : "Eye-gaze Disabled",
            }
        }
    },
    {
        key: [["host", "participant"], "volume", "level"],
        type: "number",
        default: 70,
        min: 0,
        max: 100,
        step: 5,
        toString(value){
            return Math.round(value) + "";
        },
        toIcon({value}) {
            return {
                symbol: {text: this.toString(value) + "%"},
                displayValue: "Volume",
            }
        }
    },
    {
        key: [["host", "participant"], "languages", "voice"], 
        type: "option",
        default: "default",
        options: ({name}) => {
            let languageKey = name.replace("/voice", "/language");
            let language = getValue(languageKey) || "english";
            return Object.keys(LANGUAGES[language].voices);
        },
        toString(value){
            return value[0].toUpperCase() + value.slice(1);
        },
        toIcon(s) {
            const {value, selection} = s;
            if (!selection.includes(value)) {
                s.value = selection[selection.length - 1];
            }

            return {
                symbol: {text: this.toString(s.value)},
                displayValue: "Voice",
                sideDots: s.sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "languages", "language"], 
        type: "option",
        default: "english",
        options: Object.keys(LANGUAGES).reverse(),
        toString(value){
            return value[0].toUpperCase() + value.slice(1);
        },
        toIcon({value, sideDots}) {
            return {
                symbol: {
                    url: LANGUAGES[value].flag,
                    width: 88
                },
                displayValue: this.toString(value),
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "calibration", "size"],
        type: "option",
        default: "5",
        options: ["3", "4", "5", "6", "7"],
        toIcon({value, sideDots}) {
            return {
                symbol: {text: value},
                displayValue: "Size",
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], ["languages", "calibration"], "speed"],
        type: "option",
        default: "medium",
        options: ["fast", "medium", "slow"],
        toIcon({value, sideDots}) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: "speed" + upperCase,
                displayValue: upperCase,
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"],"calibration", "guide"],
        type: "option",
        default: "default",
        options: ["default", "balloon", "squidly", "bee"],
        toIcon({value, sideDots}) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: {
                    url: relURL("../../Utilities/CalibrationGuides/" + value + ".svg", import.meta),
                },
                displayValue: upperCase,
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "display", "layout"],
        type: "option",
        default: "v-side",
        options: ["v-side", "v-top"],
        toIcon({value, sideDots}) {
            let upperCase = value == "v-side" ? "Side" : "Top";
            return {
                symbol: value,
                displayValue: upperCase,
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "display", "font"],
        type: "option",
        default: "default",
        options: ["inclusive", "atkinson", "opendyslexic", "default"],
        label2name: {
            "default": "Default",
            "inclusive": "Inclusive Sans",
            "atkinson": "Atkinson Hyperlegible",
            "opendyslexic": "OpenDyslexic",
        },
        toIcon({value, sideDots}) {
            return {
                symbol: {text: "Aa", size: "3em"},
                sideDots: sideDots,
                displayValue: this.label2name[value],
            }
        }
    },
    {
        key: [["host", "participant"], "display", "effect"],
        type: "option",
        default: "none",
        options: ["high-contrast-light", "high-contrast-dark", "low-sensory", "colorblind-assist", "greyscale", "sepia-calm", "enhanced-saturation", "none"],
        effect2name: {
            "none": "None",
            "enhanced-saturation": "Enhanced Saturation",
            "high-contrast-light": "High Contrast Light",
            "high-contrast-dark": "High Contrast Dark",
            "low-sensory": "Low Sensory",
            "colorblind-assist": "Colourblind Assist",
            "greyscale": "Greyscale",
            "sepia-calm": "Sepia Calm",
        },
        toIcon({value, sideDots}) {
            return {
                displayValue: this.effect2name[value],
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "cursors", "cursorSize"],
        type: "option",
        default: "none",
        options: ["none", "small", "medium", "large"],
        toIcon({value, sideDots}) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: {
                    url: relURL("../../Utilities/Cursors/" + value + ".svg", import.meta),
                },
                displayValue: upperCase,
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "cursors", "cursorColour"],
        type: "option",
        default: "colour-1",
        options: ["colour-1", "colour-2", "colour-3", "colour-4", "colour-5"],
        color2name: {
            "colour-1": "Black/White",
            "colour-2": "White/Black",
            "colour-3": "Black/Yellow",
            "colour-4": "Black/Green",
            "colour-5": "Blue/Yellow",
        },
        toIcon({value, sideDots}) {
            return {
                symbol: {
                    url: relURL("../../Utilities/Cursors/" + value + ".svg", import.meta),
                },
                displayValue: this.color2name[value],
                sideDots: sideDots,
            }
        }
    },
    {
        key: [["host", "participant"], "cursors", "cursorStyle"],
        type: "option",
        default: "arrow",
        options: ["arrow", "guide", "circle"],
        style2name: {
            "arrow": ["Arrow", "medium"],
            "guide": ["Guide", "guide"],
            "circle": ["Focus Ring", "circle"],
        },
        toIcon({value, sideDots}) {
            return {
                symbol: {
                    url: relURL("../../Utilities/Cursors/" + this.style2name[value][1]+ ".svg", import.meta),
                },
                displayValue: this.style2name[value][0],
                sideDots: sideDots,
            }
        }
    }
]

/** @type {Function[]} */
const settingChangeListeners = [
]
 

function onChange(...args) {
    
    for (let listener of settingChangeListeners) {  
        listener(...args);
    }
}

class Setting {
    /**
     * @param {Object} options - The options for the setting
     * @param {string} name - The name of the setting
     * @param {FirebaseFrame} sdata - The session data frame
     */
    constructor(options, name, sdata) {
        this.options = options;
        this._value = options.default;
        this.sdata = sdata;
        this.path = name;

        sdata.onValue(name, (value) => {
            
            if (value === null) {
                value = options.default;
                this.sdata.set(name, value);
            }

            if (value !== this.value) {
                this._value = value;
                onChange(name, value);
            }
        });
    }

    toggleValue() {
        if (this.options.type === "boolean") {
            this.value = !this.value;
        }
    }

    incrementValue(direction) {
        const {options, value} = this;
        if (options.type === "number") {
            let newValue = value + (direction > 0 ? options.step : -options.step);
            if (newValue > options.max) newValue = options.max;
            if (newValue < options.min) newValue = options.min;
            this.value = newValue;
        } else if (options.type === "option") {
            const selection = this.selection;
            let index = selection.indexOf(value);
            let newIndex = index + (direction > 0 ? 1 : -1);
            if (newIndex >= selection.length) newIndex = selection.length - 1;
            if (newIndex < 0) newIndex = 0;
            this.value = selection[newIndex];
        }
    }

    get sideDots() {
        const selection = this.selection;
        let sideDots = new Array(selection.length).fill(false);
        sideDots[selection.indexOf(this.value)] = true;
        return sideDots;
    }

    get selection() {
        let selection = [];
        if (this.options.type === "option") {
            selection = this.options.options;

            if (selection instanceof Function) {
                selection = selection(this);
            }
        }

        return selection;
    }

    get name() {
        return this.path;
    }

    get icon(){
        let icon = {};
        if (this.options.toIcon) {
            icon = this.options.toIcon(this);
        } else {
            icon = this.value;
        }
        return icon;
    }

    get value() {
        return this._value;
    }

    set value(value) {
        if (this.options.type === "number") {
            value = Math.max(this.options.min, Math.min(this.options.max, value));
        } else if (this.options.type === "option") {
            let selection = this.selection;
            if (!selection.includes(value)) {
                value = this.options.default;
            }
        }

        if (this.value !== value) {
            this._value = value;
            this.sdata.set(this.path, value);
            onChange(this.path, value);
        }
    }
}

/** @type {Object<string, Setting>} */
const Settings = {
}

function getSetting(name) {
    let setting = null;
    if (name in Settings) {
        setting = Settings[name];
    }
    return setting;
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/** Initialises the settings for the session
 * @param {SessionDataFrame} sdata
 */
export function initialise(sdata) {
    let hostUID = sdata.hostUID;
    let settingFrame = new FirebaseFrame(`users/${hostUID}/settings`);
    for (let options of SettingOptions) {
        let keys = getAllKeys(options.key);
        for (let key of keys) {
            Settings[key] = new Setting(options, key, settingFrame);
        }
    }
}

/** Returns the setting value for the given name 
 * @param {string} name - The name of the setting
 */
export function getValue(name) {
    let setting = getSetting(name);
    let value = null;
    if (setting) {
        value = setting.value;
    }
    return value;
}

/** Returns the setting string value for the given name
 * @param {string} name - The name of the setting
 */
export function getStringValue(name) {
    let setting = getSetting(name);
    let value = null;
    if (setting) {
        if (setting.options.toString) {
            value = setting.options.toString(setting.value);
        } else {
            value = setting.value;
        }
    }
   return value;
}

/** Add a change listener
 * @param {Function} listener - The function to call when a setting changes
 */
export function addChangeListener(listener) {
    if (listener instanceof Function) {
        settingChangeListeners.push(listener);
    }
}

/** Increments a setting by a given direction
 * @param {string} name - The name of the setting
 * @param {number} direction - The direction to increment the setting by
 */
export function incrementValue(name, direction) {
    let setting = getSetting(name);
    if (setting) {
        setting.incrementValue(direction);
    }
}

/** Toggles a setting value, if it is a boolean
 * @param {string} name - The name of the setting
 */
export function toggleValue(name) {
    let setting = getSetting(name);
    if (setting) {
        setting.toggleValue();
    }
}

/** Sets the value of a setting
 * @param {string} name - The name of the setting
 * @param {any} value - The value to set the setting to
 */
export function setValue(name, value) {
    let setting = getSetting(name);
    if (setting) {
        setting.value = value;
    }
}

/** Returns the icon for the setting with the given name
 * @param {string} name - The name of the setting
 * 
 * @returns {Object} - The icon object
 */
export function getIcon(name) {
    let setting = getSetting(name);
    let icon = {};
    if (setting) {
        icon = setting.icon;
    }
    return icon;
}