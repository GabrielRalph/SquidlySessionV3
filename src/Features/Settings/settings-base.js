import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { get, set } from "../../Firebase/firebase.js";
import { relURL } from "../../Utilities/usefull-funcs.js";

/** @typedef {import("../squidly-session.js").SessionDataFrame} SessionDataFrame */

function makeSideDots(value, options) {
    let sideDots = new Array(options.options.length).fill(false);
    sideDots[options.options.indexOf(value)] = true;
    return sideDots;
}

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
        toIcon(value, name) {
            return {
                symbol: {text: this.toString(value) + "s"},
                displayValue: name.endsWith("dwellTime") ? "Eye Gaze" : "Switch",
            }
        }
    },
    {
        key: [["host", "participant"], "keyboardShortcuts", ["video-v", "audio-a", "screen-f", "calibration-c", "grid-g", "switch-x", "quiz-q", "settings-s", "eyeGaze-e"]],
        type: "boolean",
        default: false,
        toIcon(value, name) {
            return {
                symbol: {url: relURL("../../Utilities/KeyboardIcons/" + name[name.length-1]+ ".svg", import.meta)},
                active: value,
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
        toIcon(value, name) {
            return {
                symbol: {text: this.toString(value) + "%"},
                displayValue: "Volume",
            }
        }
    },
    {
        key: [["host", "participant"], "access", "voice"], 
        type: "option",
        default: "default",
        options: Object.keys(MY_VOICES),
        toString(value){
            return value[0].toUpperCase() + value.slice(1);
        },
        toIcon(value, name) {
            return {
                symbol: {text: this.toString(value)},
                displayValue: "Voice",
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"], "calibration", "size"],
        type: "option",
        default: "5",
        options: ["3", "4", "5", "6", "7"],
        toIcon(value) {
            return {
                symbol: {text: value},
                displayValue: "Size",
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"], "calibration", "speed"],
        type: "option",
        default: "medium",
        options: ["fast", "medium", "slow"],
        toIcon(value) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: "speed" + upperCase,
                displayValue: upperCase,
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"],"calibration", "guide"],
        type: "option",
        default: "default",
        options: ["default", "balloon", "squidly", "bee"],
        toIcon(value) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: {
                    url: relURL("../../Utilities/CalibrationGuides/" + value + ".svg", import.meta),
                },
                displayValue: upperCase,
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"], "display", "layout"],
        type: "option",
        default: "v-side",
        options: ["v-side", "v-top"],
        toIcon(value) {
            let upperCase = value == "v-side" ? "Side" : "Top";
            return {
                symbol: value,
                displayValue: upperCase,
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"], "display", "cursorSize"],
        type: "option",
        default: "none",
        options: ["none", "small", "medium", "large"],
        toIcon(value) {
            let upperCase = value[0].toUpperCase() + value.slice(1);
            return {
                symbol: {
                    url: relURL("../../Utilities/Cursors/" + value + ".svg", import.meta),
                },
                displayValue: upperCase,
                sideDots: makeSideDots(value, this),
            }
        }
    },
    {
        key: [["host", "participant"], "display", "cursorColour"],
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
        toIcon(value) {
            return {
                symbol: {
                    url: relURL("../../Utilities/Cursors/" + value + ".svg", import.meta),
                },
                displayValue: this.color2name[value],
                sideDots: makeSideDots(value, this),
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

    get icon(){
        let icon = {};
        if (this.options.toIcon) {
            icon = this.options.toIcon(this.value, this.path);
        } else {
            icon = this.value;
        }
        return icon;
    }

    get value() {
        return this._value;
    }

    set value(value) {
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
        let {options, value} = setting;
        if (options.type === "number") {
            let newValue = value + (direction > 0 ? options.step : -options.step);
            if (newValue > options.max) newValue = options.max;
            if (newValue < options.min) newValue = options.min;
            if (newValue !== value) {
                setting.value = newValue;
                onChange(name, newValue);
            }
        } else if (options.type === "option") {
            let index = options.options.indexOf(value);
            let newIndex = index + (direction > 0 ? 1 : -1);
            if (newIndex >= options.options.length) newIndex = options.options.length - 1;
            if (newIndex < 0) newIndex = 0;
            if (newIndex !== index) {
                setting.value = options.options[newIndex];
                onChange(name, setting.value);
            }
        }
    }
}

/** Toggles a setting value, if it is a boolean
 * @param {string} name - The name of the setting
 */
export function toggleValue(name) {
    let setting = getSetting(name);
    
    if (setting) {
        let {options, value} = setting;
        if (options.type === "boolean") {
            let newValue = !value;
            if (newValue !== value) {
                setting.value = newValue;
                onChange(name, newValue);
            }
        }
    }
}

/** Sets the value of a setting
 * @param {string} name - The name of the setting
 * @param {any} value - The value to set the setting to
 */
export function setValue(name, value) {
    let setting = getSetting(name);
    if (setting) {
        let {options} = setting;
        if (options.type === "number") {
            value = Math.max(options.min, Math.min(options.max, value));
        } else if (options.type === "option") {
            if (!options.options.includes(value)) {
                value = options.default;
            }
        }
        if (value !== setting.value) {
            setting.value = value;
            onChange(name, value);
        }
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