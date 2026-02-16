import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { SettingOptions as _settingOptions, SettingsFrame } from "./settings-base.js";
import { get, ref } from "../../Firebase/firebase.js";

const keys = [
    ["hostAudio", "host-audio"],
    ["participantAudio", "participant-audio"],
    ["hostVideo", "host-video"],
    ["participantVideo", "participant-video"],
    ["pronouns", "pronouns"],
    ["displayName", "name"],
    ["displayPhoto", "image"],
]
export async function getHostPresets(hostUID) {
    let presets = {};
    await Promise.all(keys.map(async ([k1, k2]) => {
        let val = (await get(ref(`users/${hostUID}/info/${k1}`))).val();
        presets[k2] = val;
    }));
    return presets;
}

const SettingOptions = _settingOptions.map(options => {
    let op = {...options};
    op.key = op.key.slice(1);
    return op;
});

const ParticipantSettingOptions = [...SettingOptions, 
    {
        key: ["profileSettings", "name"],
        type: "string",
        default: "Participant",
    },
    {
        key: ["profileSettings", "image"],
        type: "file",
        fileType: "image/*",
        maxSize: 1024 * 1024, // 1 MB
        default: null,
    }
]

let HostSettings = null;
let ParticipantSettings = null;
let HostUID = null;

const profiles = {};
const profileListeners = {};
const settingChangeListeners = [];
let hostPresets = null;


export function chooseProfile(profileID) {
    if (ParticipantSettings && ParticipantSettings.profileID !== profileID) {
        ParticipantSettings.dispose();
        ParticipantSettings = null;
    }

    if (ParticipantSettings == null) {
        let participantSettings = `users/${HostUID}/settings/default`
        if (profileID) {
            participantSettings = `users/${HostUID}/settings/profiles/${profileID}`
        } 

        ParticipantSettings = new SettingsFrame(new FirebaseFrame(participantSettings), ParticipantSettingOptions);
        ParticipantSettings.profileID = profileID;
        ParticipantSettings.addChangeListener((path,value) => {
            for (let listener of settingChangeListeners) {
                listener("participant/"+path, value);
            }
        })
        ParticipantSettings._callUpdateForAllSettings();
    }
}

export function watchProfiles(hostUID, callback) {
    let profilesPath = `users/${hostUID}/settings/profiles`;
    let profilesFrame = new FirebaseFrame(profilesPath);
    
    let added = profilesFrame.onChildAdded(null, (profile, profileID) => {
        profiles[profileID] = typeof profile === "object" ? profile : {};
        profileListeners[profileID] = profilesFrame.onValue(profileID+"/profileSettings", (setting) => {
            if (profiles[profileID]) {
                profiles[profileID].profileSettings = setting;
                callback();
            }
        });
        callback();
    });

   
    let removed = profilesFrame.onChildRemoved(null, (oldData, profileID) => {
        console.log("Profile removed", profileID);
        if (profileID in profileListeners) {
            profileListeners[profileID]();
            delete profileListeners[profileID];
        }
        if (profileID in profiles) {
            delete profiles[profileID];
        }
        callback();
    });

    return () => {
        added();
        removed();
        for (let key in profileListeners) {
            profileListeners[key]();
        }
    }
}

export function getProfiles() {
    return Object.keys(profiles).map(key => {
        let name = profiles[key]?.profileSettings?.name || "Unititled Profile";
        let image = profiles[key]?.profileSettings?.image || null;
        return {profileID: key, image, name};
    });
}

export async function createProfile(hostUID, name) {
    let frame = new FirebaseFrame(`users/${hostUID}/settings/profiles`);
    let id = frame.push();
    await frame.set(id, {
        profileSettings: {
            name,
        }
    });
    return id;
}

 
/** Initialises the settings for the session
 * @param {SessionDataFrame} sdata
 */
export async function initialise(hostUID, profileID = null) {
    let hostSettingsPath = `users/${hostUID}/settings/host`
    HostUID = hostUID;
    hostPresets = await getHostPresets(hostUID);
    HostSettings = new SettingsFrame(new FirebaseFrame(hostSettingsPath), SettingOptions);
    HostSettings.addChangeListener((path,value) => {
        for (let listener of settingChangeListeners) {
            listener("host/"+path, value);
        }
    })
    chooseProfile(profileID);
}


function getSetting(name) {
    let path = name.split("/");
    let root = path[0];
    let remainingPath = path.slice(1).join("/");

    if (root === "host" && HostSettings) {
        return HostSettings._getSetting(remainingPath);
    } else if (root === "participant" && ParticipantSettings) {
        return ParticipantSettings._getSetting(remainingPath);
    } else {
        return null;
    }
}

export function getSettingsAsObject() {
    return {
        host: HostSettings ? HostSettings.settingsAsObject : {},
        participant: ParticipantSettings ? ParticipantSettings.settingsAsObject : {},
    };
}

/** Returns the setting value for the given name 
 * @param {string} name - The name of the setting
 */
export function getValue(name) {
    let value = null;
    if (name.startsWith("host/profileSettings")) {
        let key = name.split("/")[2];
        value = hostPresets ? (hostPresets[key] || null) : null;
    } else {
        let setting = getSetting(name);
        if (setting) {
            value = setting.value;
        }
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

/** Returns the selection options for the given setting name
 * @param {string} name - The name of the setting
 * @returns {[string]} - The selection options for the setting
 */
export function getSelection(name) {
    let setting = getSetting(name);
    let options = null;
    if (setting) {
        options = setting.selectionValues;
    }
    return options;
}

/**
 * Returns the name of the setting for the given name
 * @param {string} name - The name of the setting
 */
export function getName(name) {
    let setting = getSetting(name);
    let sname = null;
    if (setting) {
        sname = setting.name;
    }
    return sname;
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