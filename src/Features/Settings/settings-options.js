import { relURL } from "../../Utilities/usefull-funcs.js";

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

export {SettingOptions, LANGUAGES, MY_VOICES}