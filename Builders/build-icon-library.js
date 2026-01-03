import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function removeBrackets(text, start, close) {
    // Match all starting and closing expressions, then label the matches accordingly
    const starting = [...text.matchAll(start)].map(i => {i.type = "s"; return i})
    const closing = [...text.matchAll(close)].map(i => {i.type = "e"; return i})

    // Put all matches in an array and sort them
    let all = [...starting, ...closing];
    all.sort((a, b) => a.index - b.index)

    // For each charcter in the text determine if it is between a 
    // closing and opening expresion, if so set it to remove 
    let keep_rmv = (new Array(text.length)).fill(true)
    let state = 0;
    let si = 0;
    for (let i = 0; i < all.length; i++) {
        if (state == 0 && all[i].type == "s") {
            state = 1;
            si = i;
        } else if (state == 1 && all[i].type == "e") {
            state = 0;
            let start = all[si].index;
            let end = all[i].index + all[i][0].length;
            for (let j = start; j < end; j++) keep_rmv[j] = false;
        }
    }

    // Creating the result string
    let result = ""
    for (let i = 0; i < text.length; i++) {
        if (keep_rmv[i]) result += text[i];
    }

    return result;
}

function cleanSVG(text) {

    // remove comments
    text = removeBrackets(text, "<!--", "-->");

    // remove descriptors
    text = removeBrackets(text, /<\?/g, /\?>/g);

    // remove new line character
    text = text.replace(/\n/g, "");

    return text;
}


function getAllIconFiles(dirPath) {
    let icons = {}
    try {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const fileContents = fs.readFileSync(filePath).toString()
                const name = file.split(".")[0].replace(/^.*_/, "");
                icons[name] = cleanSVG(fileContents);
            } catch (e) {
                console.error(`Error reading file ${filePath}:`, e);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }
    return icons;
}

async function getExistingIconsLibrary(filePath) {
    // try {
        const absolutePath = path.resolve(filePath);
        const fileUrl = pathToFileURL(absolutePath).href;
        const module = await import(fileUrl);
        return module.IconSourceText;
    // } catch (e) {
    //     // Return empty object if file doesn't exist or can't be loaded
    //     console.log("No existing icons library found, starting fresh");
    //     return {};
    // }
}

async function getUpdatedIcons(dirPath) {
    const fromFiles = getAllIconFiles(path.join(dirPath, "IconLibrary"));
    const existingIcons = await getExistingIconsLibrary(path.join(dirPath, "icons-library.js"));

    const status = {};

    for (let name in existingIcons) {
        if (!fromFiles[name]) status[name] = "kept";
    }

    for (let name in fromFiles) {
        if (!existingIcons[name]) status[name] = "added";
        else status[name] = "updated";
        existingIcons[name] = fromFiles[name];
    }

    console.log("\nIcon Library Update Status:" + Object.keys(status).map(n => `\n\t${n} - ${status[n]}`).join(""));

    return existingIcons;
}


export async function buildIconLibrary(dirPath) {
    const iconsJSON = await getUpdatedIcons(dirPath);
    const names = Object.keys(iconsJSON).map(n => `"${n.trim()}"`).join("|");
    const iconEntries = Object.keys(iconsJSON).map(n => `\t"${n}": \`${iconsJSON[n]}\``);
    const module = [
        "/**",
        ` * @typedef {(${names})} IconName`,
        " * IconName is a union type of all available icon names in the library.",
        " */",
        "",
        "const IconSourceText = {",
        iconEntries.join(",\n"),
        "};",
        "",
        "export {IconSourceText};"
    ]
    fs.writeFileSync(path.join(dirPath, "icons-library.js"), module.join("\n"));
}

