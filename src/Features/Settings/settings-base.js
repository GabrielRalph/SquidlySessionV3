import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { SettingOptions } from "./settings-options.js";
// import { get, set } from "../../Firebase/firebase.js";

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