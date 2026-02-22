import { SvgPlus } from "../SvgPlus/4.js";
import { GridCard} from "./Buttons/grid-icon.js";
import { relURL } from "./usefull-funcs.js";

/**
 * Splits a sing word into multiple lines if it exceeds the max width.
 * This is used to split long words that cannot fit in the text area, 
 * such as "supercalifragilisticexpialidocious".
 * @param {string} word the word to split
 * @param {number} maxWidth the maximum width of a line
 * @param {CanvasRenderingContext2D} ctx the canvas context used to measure text width
 * @returns {string[]} an array of lines that form the word,
 *  split at appropriate points to fit within the max width.
 */
function splitWord(word, maxWidth, ctx) {
    const letters = [...word];
    const lines = [];
    let currentLine = "";
    for (let i = 0; i < letters.length; i++) {
        const testLine = currentLine + letters[i];
        const width = ctx.measureText(testLine).width;
        if (width > maxWidth) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = letters[i];
            }
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

/**
 * Wrap text breaks text into multiple lines, follwing the same 
 * wrapping algorithm as a text are. 
 * Text is initially split into lines by "\n".
 * If a line exceeds the max width it is split at 
 * the last space character that allows the line 
 * to fit within the max width. If there is no space character, 
 * i.e. a single word exceeds the max width, 
 * the word is split using the splitWord function.
 * 
 * @param {string} text the text to wrap
 * @param {number} maxWidth the maximum width of a line
 * @param {CanvasRenderingContext2D} ctx the canvas context used to measure text width
 * @returns {string[]} an array of lines that fit within the max width
 */
function wrapText(text, maxWidth, ctx) {
    const lines = [];
    const width = ctx.measureText(text).width;

    if (width <= maxWidth) {
        lines.push(text);
    } else {
        let current = "";
        let words = text.split(" ");
    
        let i = 0;
        while (i < words.length) {
            const nextWord = words[i];
            const test = current + (current ? " " : "") + nextWord;
            const width = ctx.measureText(test).width;
            if (width > maxWidth) {
                if (current) {
                    lines.push(current);
                    current = "";
                } else {
                    splitWord(nextWord, maxWidth, ctx).forEach(line => lines.push(line));
                    current = lines.pop();
                    i++;
                }
            } else {
                current = test;
                i ++;
            }
        }
    
        if (current) {
            lines.push(current);
        }
    }

    return lines
}


export class AccessTextArea extends GridCard {
    _tempCaret = 0;
    constructor() {
        super("access-textarea", "normal");
        this.mirror = this.createChild("div", {class: "mirror"});
        this.canvas = new SvgPlus("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.textArea = this.content.createChild("textarea", {
            events: {
                "keyup": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "keydown": (e) => {                    
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "mousedown": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "mouseup": (e) => {                    
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                },
                "input": (e) => {
                    const caretPosition = this.textArea.selectionStart;
                    this.updateCaretPosition(this.textArea.value.substring(0, caretPosition));
                    this.dispatchEvent(new InputEvent("input"));
                },
                "focus": (e) => {
                    this._focused = true;
                    // console.log("focused");
                    // console.log("updating caret position", this.caret);
                    // this.updateCaretPosition();

                },
                "blur": (e) => {
                    this._tempCaret = this.textArea.selectionStart;
                    this._focused = false;
                },
                "scroll": (e) => {
                    this.updateCaretPosition(true);
                }
            }
        });
        
        this.disableActiveEffect = true;
        this.disableHoverEffect = true;
        this.resizeObserver = new ResizeObserver(() => {
            this.updateCaretPosition(true);
        });
        this.resizeObserver.observe(this.textArea);
    }

    /**
     * Clears the text area and resets the caret position to 0.
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    clear(preventEvent = false) {
        this.textArea.value = "";
        this.caret = 0;
        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts a newline character at the caret position.
     */
    enter() {
        this.insert("\n");
    }

    /**
     * Removes one character before the caret position, 
     * or if there is a selection, removes the selected text.
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    backspace(preventEvent = false) {
        const start = this.caret;
        const end = this._focused ? this.textArea.selectionEnd : start;
        if (start === 0 && end === 0) return;
        const value = this.textArea.value;
        if (start === end) {
            this.textArea.value = value.substring(0, start - 1) + value.substring(end);
            this.caret = start - 1;
        } else {
            this.textArea.value = value.substring(0, start) + value.substring(end);
            this.caret = start;
        }

        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts text at the caret position, replacing any selected text.
     * @param {string} text the text to insert
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    insert(text, preventEvent = false) {
        const {valueUpToCaret, valueAfterCaret} = this
        this.textArea.value = valueUpToCaret + text + valueAfterCaret;
        this.caret = valueUpToCaret.length + text.length;

        if (!preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Inserts a suggested word at the caret position, replacing the current word fragment.
     * For example, if the text area contains "I am go" and the caret is at the end, 
     * calling insertSuggestedWord("going") will replace "go" with "going", resulting in "I am going ".
     * @param {string} word the suggested word to insert
     * @param {boolean} preventEvent if true, prevents an "input" event.
     */
    insertSuggestedWord(word, preventEvent = false) {
        const {valueUpToCaret, valueAfterCaret} = this;

        // Check if the character before the caret is a space
        const isLastCharSpaceBeforeCaret = valueUpToCaret[valueUpToCaret.length - 1] == " ";
        
        // find last space from end of valueUpToCaret
        const lastSpaceIndex = valueUpToCaret.lastIndexOf(" ");

        // If the word starts with an apostrophe, like 're, then we want to join it
        // to the previous word without a space, e.g. "you're" instead of "you 're".
        // As such we will index either after or at the index of the last space 
        // depending on whether the suggested word starts with an apostrophe.
        const startOfCurrentWord = lastSpaceIndex + (word[0] === "'" ? 0 : 1);

        // The new value up to the caret will be the text up to the index calculated above,
        // plus the suggested word.
        const newValueUpToCaret = valueUpToCaret.substring(0, startOfCurrentWord) + word;

        // Case 1: If the user is adding a suggestion after a space but directly before 
        //         some more text without a space, e.g. adding "you" to "are |going"
        //         where | is the caret, then we want to add the a space and then the 
        //         value after.
        // Case 2: "you" -> "are | going", we want to avoid addin an extra space.
        // Case 3: The user is adding a suggestion in the middle of a word,
        //         e.g. "gone" -> "are go|ing", we want to remove the fragment of the word after
        //         the caret and replace it with the suggested word.
        // 

        const nextSpace = valueAfterCaret.indexOf(" ");
        // const valueAfterPreSpace = nextSpace === -1 ? "" : valueAfterCaret.substring(0, nextSpace);
        const valueAfterPostSpace = nextSpace === -1 ? valueAfterCaret : valueAfterCaret.substring(nextSpace);
        const newValueAfter = isLastCharSpaceBeforeCaret ?
                (valueAfterCaret[0] == " " ? "" : " ") + valueAfterCaret // Case 1,2
                : (valueAfterPostSpace[0] == " " ? "" : " ") + valueAfterPostSpace; // Case 3
        



        this.textArea.value = newValueUpToCaret + newValueAfter;
        this.caret = newValueUpToCaret.length + 1;

        if (preventEvent) this.dispatchEvent(new InputEvent("input"));
    }

    /**
     * Moves the caret by a given number of characters. Positive values move the caret to the right,
     * while negative values move it to the left.
     * @param {number} dir the number of characters to move the caret
     */
    moveCaret(dir) {
        this.caret += dir;
    }

    /**
     * Gets or sets the caret position in the text area. 
     * @return {number} caret position
     */
    get caret() {
        if (this._focused) {
            return this.textArea.selectionStart;
        } else {
            return this._tempCaret;
        }
    }

    /**
     * Sets the caret position in the text area. 
     * @param {number} value the new caret position
     */
    set caret(value) {
        this._tempCaret = value;
        if (this._focused) {
            this.textArea.setSelectionRange(value, value);
        }
        this.updateCaretPosition();
    }


    /**
     * Gets or sets the value of the text area. 
     * Setting the value will also reset the caret position to 0.
     * @param {string} val the new value of the text area
     */
    set value(val) {
        this.textArea.value = val;
        this.caret = val.length;
    }

    /**
     * Gets the value of the text area.
     * @return {string} the value of the text area
     */
    get value() {
        return this.textArea.value;
    }

    /**
     * Gets the text up to the caret position. 
     * @returns {string} the text up to the caret position
     */
    get valueUpToCaret() {
        return this.value.substring(0, this.caret) || "";
    }

    /**
     * Gets the text following caret position. 
     * @returns {string} the text up to the caret position
     */
    get valueAfterCaret() {
        const end = this._focused ? this.textArea.selectionEnd : this.caret;
        return this.value.substring(end) || "";
    }


    /**
     * Updates the position of the caret in the text area. 
     * This should be called whenever the text or caret position changes.
     * @param {boolean} force if true, forces the caret position to update even 
     *                        if the text and caret position have not changed. 
     *                        This can be useful when the text area is 
     *                        scrolled or resized.
     */
    async updateCaretPosition(force = false) {
        const text = this.textArea.value;
        let compStyles = null;
        if (text !== this._lastText || force) {
            let lines = text.split("\n");
            compStyles = getComputedStyle(this.textArea);
            const font = compStyles.font;
            this.ctx.font = font;
            let wrappedLines = lines.flatMap(l => wrapText(l, this.textArea.clientWidth, this.ctx));
            this._wrapedLines = wrappedLines;
            this._lastText = text;
        }

        let caret = this.caret;

        if (caret !== this._lastCaret) {
            this.dispatchEvent(new CustomEvent("caretchange", {bubbles: true}));
        }
        this._lastCaret = caret;

        let charCount = 0;
        let lineCount = 1;
        let subString = "";
        for (let line of this._wrapedLines) {
            if (charCount + line.length >= caret) {
                subString = line.substring(0, caret - charCount);
                break;
            }
            lineCount++;
            charCount += line.length + 1;
        }

        
        if (subString !== this._lastSubString || force) {
            let x = 0;
            // console.log(`substring: "${subString}"`);
            if (subString !== "") {
                const res = this.ctx.measureText(subString);
                x = res.width;
            }
            this.styles = {
                "--caret-x": x + "px",
            }
        }
        this._lastSubString = subString;


        if (lineCount !== this._lastLineCount || force) {
            if (!compStyles) {
                compStyles = getComputedStyle(this.textArea);
            }
            let y = (lineCount - 0.4) * parseFloat(compStyles.fontSize) * 1.5;
            this.styles = {
                "--caret-y": (y - this.textArea.scrollTop) + "px",
            }
        }
        this._lastLineCount = lineCount;
    }


    static get styleSheet() {
        return relURL("./access-textarea.css", import.meta);
    }
}

