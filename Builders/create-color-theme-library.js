import Colors from '../src/Utilities/Buttons/color-themes.json' assert { type: 'json' }; 
import fs from 'fs';

function cap(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

function makeDarkenedColor(color, satFac, lightFac) {
    let hsl = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
    if (hsl) {
        let h = parseInt(hsl[1]);
        let s = parseInt(hsl[2]);
        let l = parseInt(hsl[3]);
        l = cap(l * lightFac, 0, 100);
        s = cap(s * satFac, 0, 100);
        color = `hsl(${h}, ${s}%, ${l}%)`;
    }
    return color;
}


export function buildColorThemeLibrary() {
    const COLOR_THEMES = Colors;

    for (let type in COLOR_THEMES) {
        let cardColors = COLOR_THEMES[type];
        if (!cardColors["--text"]) {
            cardColors["--text"] = "black";
        }
        
        if (!cardColors["--main-hover"]) {
            cardColors["--main-hover"] = makeDarkenedColor(cardColors["--main"], 0.95, 0.8);
        }
        if (!cardColors["--tab-hover"]) {
            cardColors["--tab-hover"] = makeDarkenedColor(cardColors["--tab"], 0.95, 0.8);
        }

        if (!cardColors["--main-active"]) {
            cardColors["--main-active"] = makeDarkenedColor(cardColors["--main"], 1.05, 0.65);
        }
        if (!cardColors["--tab-active"]) {
            cardColors["--tab-active"] = makeDarkenedColor(cardColors["--tab"], 1.05, 0.65);
        }

        if (!cardColors["--outline"]) {
            cardColors["--outline"] = makeDarkenedColor(cardColors["--tab"], 1.2, 0.6);
        }


        if (!cardColors["--icon-color"]) {
            cardColors["--icon-color"] = makeDarkenedColor(cardColors["--main"], 1, 0.3);
        }

        if (!cardColors["--icon-color-hover"]) {
            cardColors["--icon-color-hover"] = makeDarkenedColor(cardColors["--main"], 1, 0.15);
        }
    }

    console.log("\nColor themes: \n\t" + Object.keys(COLOR_THEMES).join("\n\t"));
    const gridIconTypes = Object.keys(COLOR_THEMES).flatMap(k => k === "topic" ? ["topic"] : [k, "topic-"+k]).map(k => `"${k}"`);

    const moudle = [
        `/** @typedef {(${gridIconTypes.join("|")})} GridIconTypes */`,
        "",
        "export const COLOR_THEMES = " + JSON.stringify(COLOR_THEMES, null, 4) + ";",
    ].join("\n");

    fs.writeFileSync('../src/Utilities/Buttons/color-themes.js', moudle);
}
