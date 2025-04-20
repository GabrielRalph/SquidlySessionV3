
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