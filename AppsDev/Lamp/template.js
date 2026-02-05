import { SvgPlus } from "../../src/SvgPlus/4.js";
import { AccessEvent } from "../../src/Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../src/Utilities/Buttons/grid-icon.js";
import { relURL } from "../../src/Utilities/usefull-funcs.js";

SquidlyAPI.setGridSize(8, 6);

function rgb2hsl(r, g, b) {
    r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // Achromatic (gray)
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Return HSL values in the desired range (H: 0-360, S: 0-100, L: 0-100)
  return [
    Math.round(h * 360),
    Math.round(s * 100),
    Math.round(l * 100)
  ];
};


const ACTION_CODES = {
    // # {65, 4, 6, 7, 8, 39, 10, 40, 41, 42, 43, 73, 16, 74, 20, 28, 29, 30}
    '65': 'add an s if possible',
    '4': 'play audio file',
    '6': 'Go back',
    '7': 'Go back (ok)',
    '8': 'Goto page stop go to home for 10',
    '39': 'placeholder',
    '10': 'Add word and go to home',
    '40': 'Volume up',
    '41': 'Volume down',
    '42': 'adds phonics',
    '43': 'Delete currently typed word',
    '73': 'Goto to page',
    '16': 'Backspace',
    '74': 'Open Word finder',
    '20': 'speaks everythin',
    '28': 'Clear everything',
    '29': 'speaks last word',
    '30': '',
}

let LampPages = {};

export class LampAction extends AccessEvent {
    constructor(lampButton, originalEvent) {
        const action = lampButton.actions.split(" ")[0];
        super(action, originalEvent, {bubbles: true});
        this.b = lampButton
    }
}


class LampIcon extends GridIcon {
    constructor(opts) {
        super({
            type: "white",
            displayValue: opts.label,
            symbol: opts.icon_url ? opts.icon_url : null,
            events: {
                "access-click": (e) => {
                    this.dispatchEvent(new LampAction(opts, e));
                }
            }
        }, "lamp-row-" + opts.position[1])

        
        let color = opts.style?.body_color || 0xFFFFFF;
        let fontSize = (opts.style?.font_height || 10) / 10;
        let r = (color >> 16) & 0xFF;
        let g = (color >> 8) & 0xFF;
        let b = color & 0xFF;

        let [h, s, l] = rgb2hsl(b, g, r);
        let mainHover = `hsl(${h}, ${s * 1.1}%, ${l * 0.9}%)`;
        let mainActive = `hsl(${h}, ${s * 1.2}%, ${l * 0.7}%)`;
        let outline = `hsl(${h}, ${s * 1.3}%, ${l * 0.5}%)`;


        this.styles = {
            "--main": `rgb(${b}, ${g}, ${r})`,
            "--main-hover": mainHover,
            "--main-active": mainActive,
            "--outline": outline,
            "font-size": `${fontSize* 0.5}em`,
        }
    }
}

class LampWindow extends SvgPlus {
    constructor(el = "lamp-window") {
        super(el);
        this.mainLayout = this.createChild(GridLayout, {}, 8, 6);
        this.text = new SvgPlus("div");
        this.text.class = "text"
        this.mainLayout.add(this.text, 0, 1, 0, 4);
        this.layout = this.mainLayout.add(new GridLayout(7, 12), 1, 0, 8, 5);
        this.layout.class = "lamp-layout";

        // this.mainLayout.add(new GridIcon({
        //     type: "action",
        //     symbol: "close",
        //     displayValue: "exit",
        //     events: {"access-click": e => this.dispatchEvent(new AccessEvent("close", e))}
        // }, "lamp-top"), 0, 0)

        this.mainLayout.add(new GridIcon({
            type: "action",
            symbol: "back",
            displayValue: "delete",
            events: {"access-click": e => this.deleteWord()}
        }, "lamp-top"), 0, 5);
        
        this.events = {
            "C65": e => this.addS(),
            "C6": e => this.page = 1,
            "C7": e => this.page = 1,
            "C8": ({b}) => {
                this.page = b.linked_page;
                this.typeMode = this.page;
                SquidlyAPI.firebaseSet("value3", this.page);
            },
            "C10": ({b}) => {
                this.addText(b.message);
                this.page = this.typeMode || 1;
            },
            "C42": ({b}) => this.addText(b.message),
            "C43": e => this.deleteWord(),
            "C73": ({b}) => this.page = b.linked_page,
            "C16": e => this.backspace(),
            // "C74": b => this.window.openWordFinder(),
            // "C20": b => this.window.speakAll(),
            "C28": e => this.clearText(),
            // "C29": b => this.window.speakLastWord(),
        }
        this.load();

    }


    async load(){
        LampPages = await (await fetch(relURL("./lamp_pages.json", import.meta))).json();
        this.page = 1;

        SquidlyAPI.firebaseOnValue("value1", value => {
            if (this.text.innerHTML !== value) {
                this.text.innerHTML = value;
            }
        })
        SquidlyAPI.firebaseOnValue("value2", value => {
            this.page = value;
        })
        SquidlyAPI.firebaseOnValue("value3", value => {
            this.typeMode = value;
        });
    }
   

    addS() {
        this.text.innerHTML = this.text.innerHTML.trim() + "s ";
        this._onUpdate();
    }

    addText(message) {
        this.text.innerHTML += message;
        this._onUpdate();

    }

    clearText() {
        this.text.innerHTML = "";
        this._onUpdate();

    }

    deleteWord() {
        let words = this.text.innerHTML.trim().split(" ");
        words.pop();
        this.text.innerHTML = words.join(" ") + " ";
        this._onUpdate();

    }

    backspace() {
        this.text.innerHTML = this.text.innerHTML.slice(0, -1);
        this._onUpdate();

    }

    addSpace() {
        this.text.innerHTML = this.text.innerHTML.trim() + " ";
        this._onUpdate();

    }

    clear() {
        this.layout.innerHTML = "";
        this._onUpdate();

    }

    _onUpdate() {
        SquidlyAPI.firebaseSet("value1", this.text.innerHTML);
    }

    set page(page) {
        if (this.page !== page && page in LampPages) {
            SquidlyAPI.firebaseSet("value2", page);
            this._page = page;
            if (page == 1) {
                if ((this.typeMode || 1) !== 1) 
                    this.addSpace();
                this.typeMode = 1;  
                SquidlyAPI.firebaseSet("value3", 1);
            }
            this.clear();
            let buttons = [...LampPages[page].buttons];
            buttons.sort((a, b) => a.position[1] - b.position[1] || a.position[0] - b.position[0]);
            for (let button of buttons) {
                this.layout.add(new LampIcon(button), button.position[1], button.position[0]);
            }
        } 
    }

    get page() {
        return this._page;
    }
}


SvgPlus.defineHTMLElement(LampWindow)