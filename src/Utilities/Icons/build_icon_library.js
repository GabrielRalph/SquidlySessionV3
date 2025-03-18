const fs = require('fs');
const path = require('path');

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

const processDirectory = async (dirPath) => {
    let iconsJSON = {}
    let names = []
    try {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const fileContents = fs.readFileSync(filePath).toString()
                const name = file.split(".")[0].replace(/^.*_/, "");
                iconsJSON[name] = cleanSVG(fileContents);
                names.push(name);
            } catch (e) {
                console.error(`Error reading file ${filePath}:`, e);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }

    let js = `
/**
 * @typedef {(${names.map(n => `"${n}"`).join("|")})} IconName
 */


/**
 * @type {Object.<string, string>}
 */
export const IconSourceText = {
${names.map(n => `\t"${n}": \`${iconsJSON[n]}\``).join(",\n")}
}`

    fs.writeFileSync('./icons-library.js', js)
};

processDirectory("./IconLibrary")