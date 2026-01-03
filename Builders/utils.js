
function extractFunction(stub, text) {
    let funcRegex = new RegExp(`${stub}[\\s\\n]*{`, 'g');
    let match = funcRegex.exec(text);
    if (!match) return null;

    let startIndex = match.index + match[0].length;
    let braceCount = 1;
    let currentIndex = startIndex;

    while (braceCount > 0 && currentIndex < text.length) {
        if (text[currentIndex] === '{') {
            braceCount++;
        } else if (text[currentIndex] === '}') {
            braceCount--;
        }
        currentIndex++;
    }

    if (braceCount === 0) {
        return text.slice(match.index, currentIndex);
    } else {
        return null; // No matching closing brace found
    }
}
 
export { extractFunction };