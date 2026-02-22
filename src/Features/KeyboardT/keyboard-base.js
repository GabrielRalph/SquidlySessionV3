import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { LetterEvent } from "../../Utilities/search.js";
import { getSuggestions } from "./WordPrediction/predict.js";

/**
 * @class SuggestionEvent 
 * the suggestion event is dispatched when a suggestion icon is clicked.
 * It contains the suggested word in the `word` property.
 */
class SuggestionEvent extends AccessEvent {
    
    constructor(element, e) {
        super("suggestion", e, {bubbles: true});

        /**
         * @type {string}
         */
        this.word = element.value;
    }
}

/**
 * @class KeyBoardActionEvent
 * the keyboard action event is dispatched when a keyboard action icon is clicked.
 * The type of action is specified in the `action` property, which can be one of:
 * - "shift"
 * - "space"
 * - "enter"
 * - "clear"
 * - "caret-left"
 * - "caret-right"
 * - "backspace"
 * - "submit"
 */
class KeyBoardActionEvent extends AccessEvent {
    constructor(action, e) {
        super(action, e, {bubbles: true});
        this.action = action;
    }
}

/**
 * @class NewWordEvent
 * the new word event is dispatched when a new word is formed in the text area, 
 * either by inserting a space or by inserting a suggestion.
 * The new word is specified in the `word` property.
 */
class NewWordEvent extends CustomEvent {
    constructor(word) {
        super("new-word", {detail: {word}, bubbles: true});
        this.word = word;
    }
}

/**
 * @class KeyboardIcon
 * the keyboard icon represents a key on the keyboard. It can be either a letter or an action.
 * If it is a letter, it will have the `isLetter` property set to true, 
 * and the `option` property can be used to set the displayed letter
 * if there are multiple shift options.
 */
export class KeyboardIcon extends GridIcon {
    constructor(name, group) {
        if (name in KeyboardIcon.KEYBOAD_ACTIONS) {
            super(KeyboardIcon.KEYBOAD_ACTIONS[name], group);
            this.events = {
                "access-click": (e) => {
                    if (KeyboardIcon.KEYBOAD_ACTIONS[name].accessClickEvent) {
                        KeyboardIcon.KEYBOAD_ACTIONS[name].accessClickEvent(e, this);
                    } else {
                        let eventName = KeyboardIcon.KEYBOAD_ACTIONS[name].eventName || name;
                        this.dispatchEvent(new KeyBoardActionEvent(eventName, e));
                    }
                }
            }
            this._isLetter = false;
        } else {
            super({type: "adjective", displayValue: ""}, group);
            let options = name;
            if (typeof name === "string") {
                options = [name];
            }
            this._isLetter = true;
            this.options = options;
            this.option = 0;
            this.events = {
                "access-click": (e) => {
                    if (this._letter) {
                        this.dispatchEvent(new LetterEvent(this._letter, e));
                    }
                }
            }
        }

    }

    onresize(e) {
        super.onresize(e);
        if (!this.isLetter) {
            this.displayValueElement?.adjustFS();
        }
    }


    get isLetter() {
        return this._isLetter;
    }

    set option(i) {
        if (this._isLetter) {
            let option = this.options[i];
            if (option) {
                this._letter = this.options[i] || "";
                this.symbol = {text: this._letter};
                this.hidden = false;
            } else {
                this.hidden = true;
            }
        }
    }

    static get KEYBOAD_ACTIONS() {
        return {
            "shift": {
                displayValue: "Shift",
                type: "action",
            },
            "space": {
                displayValue: "Space",
                type: "action",
                symbol: "space",
                accessClickEvent: (e, el) => el.dispatchEvent(new LetterEvent("space", e))
            },
            "close": {
                displayValue: "Close",
                type: "action",
                symbol: "close",
            },
            "enter": {
                displayValue: "Enter",
                symbol: "enter",
                type: "action",
            },
            "clear": {
                symbol: "trash",
                displayValue: "Clear",
                type: "action",
            },
            "caret-left": {
                symbol: "leftArrow",
                type: "action",
            },
            "caret-right": {
                symbol: "rightArrow",
                type: "action",
            },
            "backspace": {
                symbol: "back",
                type: "action",
                displayValue: "Backspace"
            },
            "call2action": {
                symbol: "send",
                displayValue: "Send",
                type: "action",
                eventName: "submit"
            },
            "switch-keyboard": {
                symbol: "next",
                displayValue: "Switch Keyboard",
                type: "action",
            }
        }
    }

}

/**
 * @class SuggestionIcon
 * the suggestion icon represents a word suggestion. It is displayed in the suggestion bar above the keyboard.
 * It has a `value` property which contains the suggested word. When clicked, it dispatches a `SuggestionEvent`
 * with the suggested word in the `word` property.
 */
export class SuggestionIcon extends GridIcon {
    constructor(_, group) {
        super({type: "normal",
            events: {
                "access-click": (e) => {
                    if (this.displayValue) {
                        this.dispatchEvent(new SuggestionEvent(this, e));
                    }
                }
            }
        }, group);
        this.value = null;
    }

    set value(word) {
        if (typeof word !== "string" || word.trim() === "") {
            this.hidden = true;
            this._value = null;
        } else {
            this.hidden = false;
            this.displayValue = word;
            this._value = word;
            this.onresize();
        }

    }

    get value() {
        return this._value;
    }

    onresize(e) {
        super.onresize(e);
        this.displayValueElement?.adjustFS();
    }
}

const SpaceRemovalCharacters = new Set([
    ".", ",", "!", "?", ";", ":", "'", "\""
])

export class KeyboardLayout extends GridLayout {
    constructor(rows, cols, ...args) {
        super(rows, cols);

        this.buildKeyboard(...args);

        const {textArea} = this;
        textArea.events = {
            "input": (e) => {
                this.updateSuggestions();
            },
            "caretchange": (e) => {
                this.updateSuggestions();
            }
        }

        this.events = {
            "letter":       e =>    this.insertLetter(e.value, e),
            "clear":        e =>    textArea.clear(),
            "caret-left":   e =>    textArea.moveCaret(-1),
            "caret-right":  e =>    textArea.moveCaret(1),
            "backspace":    e =>    textArea.backspace(),
            "enter":        e =>    textArea.enter(),
            "suggestion":   e =>    this.insertSuggestion(e.word),
        }
        this.updateSuggestions();
    }

    buildKeyboard() { }

    getTextArea() {return this._textArea;}

    
    getSuggestionIcons() {return this._suggestionIcons;}


    handleKeyEvent(e) {
        let prevent = true
        switch(e.key) {
            case "Backspace":
                this.textArea.backspace();
                break;
            case "Enter":
                this.textArea.enter();
                break;
            case "ArrowLeft":
                this.textArea.moveCaret(-1);
                break;
            case "ArrowRight":
                this.textArea.moveCaret(1);
                break;
            default:
                if (e.key.length === 1 && e.key !== "x") {
                    this.insertLetter(e.key, new AccessEvent("keydown", "keyboard", {bubbles: true}));
                } else {
                    prevent = false;
                }
        }
        if (prevent) e.preventDefault();
    }

    insertLetter(letter, e) {
        if (SpaceRemovalCharacters.has(letter) && this.textArea.valueUpToCaret.endsWith(" ")) {
            this.textArea.backspace(true);
            this.textArea.insert(letter + " ");
            console.log("Inserted letter with space removal", letter);
        } else {
            this.textArea.insert(letter);
        }

        if (letter === " ") {
            this._onNewWord();
        }
    }

    insertSuggestion(word) {
        this.textArea.insertSuggestedWord(word)
        this._onNewWord();
    }
            
    updateSuggestions() {
        const {valueUpToCaret} = this.textArea;
        const suggestions = getSuggestions(valueUpToCaret, this.suggestionIcons.length);
        
        for (let i = 0; i < this.suggestionIcons.length; i++) {
            const suggestionIcon = this.suggestionIcons[i];
            suggestionIcon.value = suggestions[i]?.word || null;
        }
    }

    get textArea() {
        return this.getTextArea();
    }

    get suggestionIcons() {
        return this.getSuggestionIcons();
    }

    get value() { return this.textArea.value; }

    set value(value) { 
        console.log(`Setting text area value to: "${value}"`);
        this.textArea.value = value; 
    }

    _onNewWord() {
        let {valueUpToCaret} = this.textArea;
        let words = valueUpToCaret.trim().split(" ")
        let lastWord = words.pop().replace(/[^a-zA-Z0-9]+/g, "");
        if (this._lastNewWord !== lastWord) {
            this.dispatchEvent(new NewWordEvent(lastWord));
        }
        this._lastNewWord = lastWord;
    }

}
