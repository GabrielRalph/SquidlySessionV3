import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { Rotater } from "../../Utilities/rotater.js";
import { AccessTextArea } from "../../Utilities/access-textarea.js";
import { KeyboardIcon, KeyboardLayout, SuggestionIcon } from "./keyboard-base.js";

function makeLettersIcon(letters) {
    let letterText = [...letters].slice(0,9).map((l, i) => `<text x = "${i%3}" y ="${Math.floor(i/3)}" font-size = "0.7" fill="white" font-family = "monospace">${l}</text>`).join("");
    let svg = `<svg viewBox="0 -0.7 2.5 3" xmlns="http://www.w3.org/2000/svg">${letterText}</svg>`;
    return svg;
}

export class LettersEvent extends AccessEvent {
    constructor(letters, originalEvent) {
        super("show-letters", originalEvent, {bubbles: true});
        this.letters = letters;
    }
}

export class LettersIcon extends GridIcon {
    constructor(letters, group) {
        super({
            type: "topic-action",
            symbol: {svg: makeLettersIcon(letters)}
        }, group);
        this.events = {
            "access-click": (e) => {
                this.dispatchEvent(new LettersEvent(letters, e));
            }
        }
    }
}

const letterOps = {
    "1": ["1","!"],
    "2": ["2","@"],
    "3": ["3","#"],
    "4": ["4","$"],
    "5": ["5","%"],
    "6": ["6","^"],
    "7": ["7","&"],
    "8": ["8","*"],
    "9": ["9","("],
    "0": ["0",")"],
    ",": [",","<"],
    ".": [".",">"],
    "/": ["/","?"],
    "'": ["'","\""],
    "-": ["-","_"],
    "=": ["=","+"],
    ";": [";",":"],
    "[": ["[","{"],
    "]": ["]","}"],
    "`": ["`","~"],
}

class LetterLayout extends GridLayout {
    constructor() {
        super(3, 5);
        this.suggestionIcons = this.addItemInstances(SuggestionIcon, [[1, null],[2, 2],[3, 3]], 0, 3).flat().filter(i => i);
        this.add(new KeyboardIcon("shift"), 0, 4);
        this._letters = [];
        this._maxOptions = 1;
        this.shiftOption = 0;

        this.events = {
            "shift": e => this.shiftOption++
        }
    }

    set letters(letters) {
        for (let l of this._letters) l.remove();
        this._letters = [];
        this._maxOptions = 1;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                let index = i*3 + j;
                if (index < letters.length) {
                    let letter = letters[index];
                    if (letter.match(/^[a-z]$/i)) {
                        letter = [letter.toLowerCase(), letter.toUpperCase()];
                        this._maxOptions = 2;
                    } else if (letter in letterOps) {
                        letter = letterOps[letter];
                        this._maxOptions = Math.max(this._maxOptions, letter.length);
                    }
                    this._letters.push(
                        this.add(new KeyboardIcon(letter), i, j)
                    );
                }
            }
        }
        this.shiftOption = this.shiftOption;
    }


    set shiftOption(i) {
        if (typeof i !== "number" || Number.isNaN(i)) i = 0;
        i = i % this._maxOptions;

        for (let icon of this._letters) {
            icon.option = i;
        }
        this._option = i;
    }

    get shiftOption() {
        return this._option || 0;
    }
}

export class FolderKeyboard extends KeyboardLayout {
    constructor() {
        super(4, 5);

        this.events = {
            "show-letters": this.showLetters.bind(this),
            "close": e => {
                if (this._page === "letters") {
                    e.stopPropagation();
                    e.waitFor(this.gotoMain());
                }
            }
        }
    }

    insertLetter(letter, e) {
        if (this._page === "letters") {
            if (this.lettersPage.shiftOption == 1) {
                letter = letter.toUpperCase();
            }
        }
        super.insertLetter(letter);

        if (this.lettersPage.shiftOption > 0) {
            this.lettersPage.shiftOption = 0;
        } else if (letter === ".") {
            this.lettersPage.shiftOption = 1;
        }
    }

    insertSuggestion(suggestion, e) {
        super.insertSuggestion(suggestion, e);
        if (this._page === "letters" && this.lettersPage.shiftOption > 0) {
            this.lettersPage.shiftOption = 0;
        }
    }

    async gotoMain() {
        this._page = "main";
        this.updateSuggestions();
        this.closeIcon.displayValue = "close";
        this.closeIcon.symbol = "close";
        await this.rotater.setContent(this.main);
    }

    async showLetters(e) {
        let letters = e.letters;
        this.lettersPage.letters = letters;
        this._page = "letters";
        this.updateSuggestions();
        this.closeIcon.displayValue = "back";
        this.closeIcon.symbol = "leftArrow";
        e.waitFor(this.rotater.setContent(this.lettersPage));
    }
    
    getSuggestionIcons() {
        if (this._page === "main") {
            return this._suggestionIconsMain;
        } else {
            return this.lettersPage.suggestionIcons;
        }
    }

    buildKeyboard() {
        [this.closeIcon] = this.addItemInstances(KeyboardIcon, ["close", "space", null, null, "call2action"], 0, 0);
        this._textArea = this.addItemInstance(AccessTextArea,null, 0, [2, 3]);

        let rotater = new Rotater();
        this.add(rotater, [1,3], [0,4]);

        let main = new GridLayout(3, 5);
        main.addItemInstances(KeyboardIcon, [["backspace"], ["clear"], ["enter"]], 0, 4);

        this._suggestionIconsMain = main.addItemInstances(SuggestionIcon, [[1,1],[2,2],[3,3]], 0, 2).flat();

        main.addItemInstances(LettersIcon, [["abcdefghi", "jklmnopqr"], ["stuvwxyz0", "123456789"], [null, "-=;',.[]`"]], 0, 0);

        this.switchIcon = main.addItemInstance(KeyboardIcon, "switch-keyboard", 2, 0);
        this.switchIcon.symbol = "back";

        rotater.setContent(main, true);
        
        this.main = main;
        this.lettersPage = new LetterLayout();
        this.rotater = rotater;
        this._page = "main";
    }

}