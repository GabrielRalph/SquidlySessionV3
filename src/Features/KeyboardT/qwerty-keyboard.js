
import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessTextArea } from "../../Utilities/access-textarea.js";
import { KeyboardIcon, KeyboardLayout, SuggestionIcon } from "./keyboard-base.js";

const key2button = {
    "xx": (gi) => new KeyboardIcon("close", gi),
    "sp": (gi) => new KeyboardIcon("space", gi),
    "ta": () => new AccessTextArea(),
    "nl": (gi) => new KeyboardIcon("enter", gi),
    "cl": (gi) => new KeyboardIcon("caret-left", gi),
    "cr": (gi) => new KeyboardIcon("caret-right", gi),
    "bs": (gi) => new KeyboardIcon("backspace", gi),
    "sg": (gi) => new SuggestionIcon(null, gi), //suggestions - will be handled separately
    "sh": (gi) => new KeyboardIcon("shift", gi),
    "ca": (gi) => new KeyboardIcon("clear", gi),
    "sk": (gi) => new KeyboardIcon("switch-keyboard", gi),
    "c2a": (gi) => new KeyboardIcon("call2action", gi),
}

const QWERTY_KEYBOARD_LAYOUT = `
    xx     ta[8]                                                   c2a
    nl     sg     sg     sg     sg     sg     sg     sg     ca      bs
    1|!    2|@    3|#    4|$    5|%    6|^    7|&    8|*    9|(    0|)
    q|Q    w|W    e|E    r|R    t|T    y|Y    u|U    i|I    o|O    p|P
    a|A    s|S    d|D    f|F    g|G    h|H    j|J    k|K    l|L    '|"
    z|Z    x|X    c|C    v|V    b|B    n|N    m|M    ,|<    .|>    /|?
    sk     sh[2]  sp[5]                                     cl     cr
`

export class QwertyKeyboard extends KeyboardLayout {
    constructor(layout = QWERTY_KEYBOARD_LAYOUT) {
        super(1,1, layout);

        this.events = {
            "shift": e =>  this.shiftOption++,
        }
    }

    buildKeyboard(layout) {
        let maxOptions = 0;
       
        // Parse the icons
        let icons = layout.split("\n")
        .filter(l => l.trim() !== "")
        .map((r,i) => r.trim().split(/\s+/).map(k => {
            let match = k.match(/(\[(\d+)\])$/);
            let span = 1;
            if (match) {
                span = match[2] ? parseInt(match[2]) : 1;
                k = k.replace(match[0], "");
            } 
            let ops = k.split("|");
            let icon = ops[0] in key2button ? key2button[ops[0]]("kb-"+i) : new KeyboardIcon(ops, "kb-"+i)
            maxOptions = ops.length > maxOptions ? ops.length : maxOptions;
            
            return {icon, ops, span}
        }));

        // Set the size of the grid
        const rows = icons.length;
        const cols = Math.max(...icons.map(r => r.reduce((sum, i) => sum + (i?.span || 1), 0)));
        this.size = [rows, cols];

        // Add the icons to the grid
        this._maxOptions = maxOptions;
        let suggestionIcons = []
        let letterIcons = [];
        let textArea = null;
        for (let r = 0; r < rows; r++) {
            let c = 0;
            for (let i of icons[r]) {
                if (i) {
                    if (SvgPlus.is(i.icon, SuggestionIcon)){
                        suggestionIcons.push(i.icon);
                    } else if (SvgPlus.is(i.icon, AccessTextArea)) {
                        textArea = i.icon;
                    } else if (SvgPlus.is(i.icon, KeyboardIcon) && i.icon.isLetter) {
                        letterIcons.push(i.icon);
                    }
                    this.add(i.icon, r, [c, c + i.span - 1]);
                    c += i.span;
                }
            }
        }

        this._suggestionIcons = suggestionIcons;
        this._textArea = textArea;
        this._letterIcons = letterIcons;
    }

    insertLetter(letter) {
        if (this.shiftOption == 1) {
            letter = letter.toUpperCase();
        }
        super.insertLetter(letter);

        if (this.shiftOption > 0) {
            this.shiftOption = 0;
        } else if (letter === ".") {
            this.shiftOption = 1;
        }
    }

    set shiftOption(i) {
        if (typeof i !== "number" || Number.isNaN(i)) i = 0;
        i = i % this._maxOptions;

        for (let icon of this._letterIcons) {
            icon.option = i;
        }
        this._option = i;
    }

    get shiftOption() {
        return this._option || 0;
    }
}