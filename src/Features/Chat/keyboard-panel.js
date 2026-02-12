import { LetterEvent, SearchBar } from "../../Utilities/search.js";
import { GridCard, GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { Rotater } from "../../Utilities/rotater.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { completeWord, completeWordSync, predictNextWordSync, topFourWords } from "./algorithm/index.js";
// import { LetterIcon, LettersIcon, LetterLayout } from "./letter-selector.js";
import { LetterIcon, LettersIcon } from "../../Utilities/search.js";

// Letter layout for displaying 9 letters in a 2x5 grid
// Row 0: A-E (5 letters), Row 1: F-I (4 letters)
// Each letter button is the same size as back button (1 grid cell)
export class LetterLayout extends GridLayout {
    constructor() {
        super(2, 5); // 2 rows, 5 columns
        this.delete = this.add(new GridIcon({
            type: "action",
            displayValue: "Delete", // Empty space for alignment
            symbol: "back",
            events: {
                "access-click": (e) => this.dispatchEvent(new LetterEvent("backspace", e))
            }
        }, "ll-row-1"), 1, 4)
    }

    /**
     * Show the letters in the letter grid.
     * @param {string} letters - String of letters to display (e.g., "abcdefghi")
     */
    set letters(letters) {
        this.innerHTML = "";
        const lettersArray = [...letters].slice(0, 9);

        // Functional approach: calculate row/col instead of if-else
        lettersArray.forEach((letter, i) => {
            const icon = new LetterIcon(letter, `ll-row-${Math.floor(i / 5)}`);
            const row = Math.floor(i / 5); // 0 for first 5, 1 for next 4
            const col = i % 5; // Column position within row
            this.add(icon, row, col);
        });
        this.add(this.delete, 1, 4);
    }
}

// WordSuggestionIcon - similar to OptionIcon in search.js, but for word suggestions
class WordSuggestionIcon extends GridIcon {
    constructor(word, index) {
        super({
            symbol: null, // No symbol, only text
            displayValue: word, // Main word (large, bold) - displayed at top
            type: "adjective",
            events: {
                "access-click": (e) => {
                    const event = new AccessEvent("word-suggestion", e, { bubbles: true });
                    event.detail = { word };
                    this.dispatchEvent(event);
                }
            }
        }, "word-suggestion");

        this.word = word;
        this.index = index;
        this.styles = {

        };
    }
}

class WordSuggestions extends GridLayout {
    constructor() {
        super(2, 2); // 2 rows, 2 columns for 4 suggestions
        this.class = "word-suggestions-area";
    }

    set suggestions(words) {
        if (!Array.isArray(words) || words.length === 0) {
            words = topFourWords;
        }
        this.innerHTML = "";
        words = words.slice(0, 4); // Limit to 4 suggestions
        words.map((word, index) => this.createChild(WordSuggestionIcon, {}, word, index));
    }
}


export class ChatInput extends GridCard {
    constructor(events) {
        super("search-bar", "normal");

        this.input = this.content.createChild("textarea", {
            events: {
                "focusin": (e) => {
                    this.toggleAttribute("hover", true)
                },
                "focusout": (e) => {
                    this.toggleAttribute("hover", false)

                },
                ...events
            }
        })
        this.input.setAttribute("placeholder", "Type...");

    }

    get value() {
        return this.input.value;
    }

    set value(value) {
        this.input.value = value;
    }
}


export class KeyboardPanel extends HideShowTransition {
    constructor(feature) {
        super("keyboard-panel", "up");
        this.feature = feature;

        // ~~~~~~~ Build Element ~~~~~~~
        const rootGrid = this.createChild(GridLayout, { class: "keyboard-panel-grid" }, 3, 5);

        // ~~~~~ Build top panel ~~~~~
        // ~~ Back Button ~~
        this.backButton = rootGrid.add(new GridIcon({
            symbol: "downArrow",
            displayValue: "Keyboard",
            type: "action",
            events: { "access-click": e => e.waitFor(this._onBackButton()) }
        }, "chat"), 0, 0);

        // ~~ Space Button ~~
        rootGrid.add(new GridIcon({
            symbol: "space",
            displayValue: "Space",
            type: "action",
            events: {
                "access-click": (e) => this.dispatchEvent(new LetterEvent("space", e))
            }
        }, "chat"), 0, 1)

        // ~~ Chat Input ~~
        this.chatInput = rootGrid.add(new ChatInput({
            "keydown": (e) => { if (e.key === "Escape") this.chatInput.input.blur() },
            "input": () => this._syncInputAndSuggestions()
        }), 0, 2, 0, 3);

        // ~~ Send Button ~~
        rootGrid.add(new GridIcon({
            symbol: "send",
            displayValue: "Send",
            type: "action",
            events: { "access-click": e => e.waitFor(this._send()) }
        }, "chat"), 0, 4);

        // ~~~~~ Build rotater ~~~~~
        this.rotater = rootGrid.add(new Rotater(), 1, 0, 2, 4);

        // ~~~~ Build default layout ~~~~
        let defaultLayout = new GridLayout(2, 5);

        // ~~ Letters Icons ~~
        defaultLayout.add(new LettersIcon("atoi", "chat"), 0, 0);
        defaultLayout.add(new LettersIcon("jtor", "chat"), 1, 0);
        defaultLayout.add(new LettersIcon("sto0", "chat"), 0, 1);
        defaultLayout.add(new LettersIcon("1to9", "chat"), 1, 1);

        // ~~ Word Suggestions ~~
        this.wordSuggestions = defaultLayout.add(new WordSuggestions(), 0, 2, 1, 3);

        // ~~ Backspace Key ~~
        defaultLayout.add(new GridIcon({
            symbol: "back",
            displayValue: "Delete",
            type: "action",
            events: {
                "access-click": (e) => this.dispatchEvent(new LetterEvent("backspace", e))
            }
        }, "chat"), 0, 4)

        // ~~ Enter Key ~~
        defaultLayout.add(new GridIcon({
            symbol: "leftArrow",
            displayValue: "Enter",
            type: "action",
            events: {
                "access-click": (e) => this.dispatchEvent(new LetterEvent("\n", e))
            }
        }, "chat"), 1, 4);

        this.defaultLayout = defaultLayout;

        // ~~~~ Build letters layout ~~~~
        this.lettersLayout = new LetterLayout();


        // ~~~~~~~ Events ~~~~~~~
        this.events = {
            "show-letters": e => e.waitFor(this.setMode(e.letters)),
            "letter": e => e.waitFor(this.insertText(e.value)),
            "word-suggestion": e => e.waitFor(this._addSuggestion(e.detail.word))
        }

        this.setMode("default", true);
        this._updateWordSuggestions();
    }


    /**
     * Insert text into the chat input at the current cursor position.
     * @param {string} text - The text to insert (can be a letter or "backspace").
     */
    async insertText(text) {

        const { input } = this.chatInput;

        const currentValue = input.value || '';

        input.focus();
        const cursorPos = input.selectionStart ?? currentValue.length;
        const beforeCursor = currentValue.substring(0, cursorPos);
        const afterCursor = currentValue.substring(cursorPos);

        if (text == "backspace") {
            input.value = beforeCursor.slice(0, -1) + afterCursor;
            input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        } else {
            input.value = beforeCursor + text + afterCursor;
            input.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
        }

        if (this._mode === "letters") await this.setMode("default");
        this._syncInputAndSuggestions();
    }

    /**
     * Set the keyboard panel mode.
     * @param {string} mode - "default" for default layout, or a string of letters for letters layout.
     * @param {boolean} [immediate=false] - If true, set the content immediately without transition.
     */
    async setMode(mode, immediate = false) {
        if (mode == "default" || typeof mode !== "string") {
            await this.rotater.setContent(this.defaultLayout, immediate);
            this.backButton.displayValue = "Keyboard";
            this.backButton.symbol = "downArrow";
            this._mode = "default";
        } else {
            this.lettersLayout.letters = mode;
            await this.rotater.setContent(this.lettersLayout, immediate);
            this.backButton.displayValue = "Back";
            this.backButton.symbol = "back";
            this._mode = "letters";
        }
    }

    _syncInputAndSuggestions() {
        this.feature._onKeyboardInputChange?.(this.chatInput.value);
        this._updateWordSuggestions();
    }

    /**
     * Update word suggestions based on current input.
     * After space (next-word context): use predictNextWordSync. Otherwise: completeWordSync (partial word).
     */
    _updateWordSuggestions() {
        const currentInput = this.chatInput.value || '';
        let suggestions;
        if (currentInput.length === 0 || currentInput.endsWith(' ')) {
            suggestions = predictNextWordSync(currentInput, 4);
        } else {
            suggestions = completeWordSync(currentInput, 4);
        }
        if (!suggestions?.length) suggestions = topFourWords;
        this.wordSuggestions.suggestions = suggestions;
    }

    /**
     * Handle back button click based on current mode.
     */
    async _onBackButton() {
        if (this._mode === "default") {
            await this.hide();
        } else {
            await this.setMode("default");
        }
    }

    /**
    * Handle word suggestion click
    * Replace the current incomplete word with the selected suggestion
    * @param {string} word - The selected word
    * @param {Event} e - The click event
    */
    _addSuggestion(word) {
        const { input } = this.chatInput;

        const currentValue = input.value || '';
        const cursorPos = input.selectionStart ?? currentValue.length;
        const beforeCursor = currentValue.substring(0, cursorPos);
        const afterCursor = currentValue.substring(cursorPos);

        const wordMatch = beforeCursor.match(/(\S*)$/);
        const currentWord = wordMatch?.[1] || '';
        const wordStartPos = cursorPos - currentWord.length;

        const beforeWord = currentValue.substring(0, wordStartPos);

        // Functional approach: determine space after using regex test
        const spaceAfter = afterCursor.length > 0 || !/^\s/.test(afterCursor) ? ' ' : '';
        const newValue = beforeWord + word + spaceAfter + afterCursor;

        input.value = newValue;
        input.focus();
        let newCursorPos = wordStartPos + word.length + spaceAfter.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
        this._syncInputAndSuggestions();
    }

    async _send() {
        const text = (this.chatInput.value ?? '').trim();
        if (!text) return;
        if (!(await this.feature._sendMessage(text))) return;
        this.chatInput.value = "";
        this._syncInputAndSuggestions();
        await this.hide();
    }
}