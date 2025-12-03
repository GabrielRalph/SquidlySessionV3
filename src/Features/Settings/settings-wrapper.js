import { FirebaseFrame } from "../../Firebase/firebase-frame.js";
import { SettingOptions as _settingOptions, SettingsFrame } from "./settings-base.js";

const SettingOptions = _settingOptions.map(options => {
    let op = {...options};
    op.key = op.key.slice(1);
    return op;
});

const ParticipantSettingOptions = [...SettingOptions, 
    {
        key: ["profileSettings", "name"],
        type: "string",
        default: "participant",
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
export function watchProfiles(hostUID, callback) {
    let profilesPath = `users/${hostUID}/settings/profiles`;
    let profilesFrame = new FirebaseFrame(profilesPath);
    
    let added = profilesFrame.onChildAdded(null, (profile, profileID) => {
        profiles[profileID] = profile;
        profileListeners[profileID] = profilesFrame.onValue(profileID+"/profileSettings", (setting) => {
            if (profiles[profileID]) {
                profiles[profileID].profileSettings = setting;
                callback();
            }
        });
        callback();
    });

   
    let removed = profilesFrame.onChildRemoved(null, (profileID) => {
        profileListeners[profileID]();
        delete profiles[profileID];
        delete profileListeners[profileID];
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
        return {profileID: key, ...profiles[key].profileSettings};
    });
}


 
/** Initialises the settings for the session
 * @param {SessionDataFrame} sdata
 */
export function initialise(hostUID, profileID = "-OfXcjuq0hbmxBliV6yM") {
    let hostSettingsPath = `users/${hostUID}/settings/host`
    HostUID = hostUID;
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

const settingChangeListeners = [];


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

export function getSelection(name) {
    let setting = getSetting(name);
    let options = null;
    if (setting) {
        options = setting.selectionValues;
    }
    return options;
}


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