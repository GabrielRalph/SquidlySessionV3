import path from 'path';
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


export function buildGridIconThemes(directory, baseStyle = "grid-icon-base.css", outputFile = "grid-icon.css") {
    const jsonDir = path.join(directory, "color-themes.json");
    const COLOR_THEMES = JSON.parse(fs.readFileSync(jsonDir, "utf-8")) || {};

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

    const gridIconCSS = Object.keys(COLOR_THEMES).map(type => {
        let header = `.grid-icon[type="${type}"]` + (type === "topic" ? "" : `, .grid-icon[type="topic-${type}"]`);
        let entries = Object.entries(COLOR_THEMES[type])
            .map(([key, value]) => `    ${key}: ${value};`).join("\n");
        return `${header} {\n${entries}\n}`;
    }).join("\n\n");

    console.log("\nGenerated Grid Icon Themes:\n" + Object.keys(COLOR_THEMES).map(t => `\t${t}`).join("\n"));
    
    const baseCSS = fs.readFileSync(path.join(directory, baseStyle), "utf-8");
    const moudle = `${baseCSS}\n\n${gridIconCSS}`;
    fs.writeFileSync(path.join(directory, outputFile), moudle);
}
