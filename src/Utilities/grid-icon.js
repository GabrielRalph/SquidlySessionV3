import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { AccessButton } from "./access-buttons.js";
import { Icon, isIconName } from "./Icons/icons.js";
import { MarkdownElement } from "./markdown.js";
import { relURL } from "./usefull-funcs.js";

/**
 * @typedef {string | {url: string}} IconSymbol
 */

/**
 * @typedef {Object} GridIconOptions
 * @param {("topic"|"normal"|"starter"|"noun"|"verb"|"adjective"|"action"|"topic-normal"|"topic-starter"|"topic-verb"|"topic-adjective")} type
 * @param {string} displayValue 
 * @param {string} [subtitle] - The icon symbol, can be a string or an object with a url.
 * @param {IconSymbol} [symbol]
 * @param {boolean} [hidden] - If true, the icon will be hidden.
 */

const BORDER_RADIUS_PERCENTAGE = 0.015;
const BORDER_SIZE = 4;

function plainCard(size, border = BORDER_SIZE) {
    let inSize = size.sub(border);
    let g = Math.min(window.innerWidth, window.innerHeight) * BORDER_RADIUS_PERCENTAGE;
    return `<rect class = "card" x = "${border/2}" y = "${border/2}" width = "${inSize.x}"  height = "${inSize.y}" rx = "${g}" ry = "${g}" />
            <rect stroke-width = "${border}" class = "outline" x = "${border/2}" y = "${border/2}" width = "${inSize.x}"  height = "${inSize.y}" rx = "${g}" ry = "${g}" />`
}

function folderCard(size, border = BORDER_SIZE) {
    let inSize = size.sub(border);
    let g = Math.min(window.innerWidth, window.innerHeight) * BORDER_RADIUS_PERCENTAGE;
    let w = inSize.x;
    let b = w * 0.45;

    g = Math.min(b / 3, g);

    let t = g / 3;
    let h = inSize.y;

    let p0 = new Vector(border/2, border/2 + 2*g);
    let p1 = p0.addV(-g);
    let p2 = p1.add(g, -g);

    let c2 = p1.addH(b);
    let c1 = c2.add(-g);
    
    let tv = new Vector(t, 0);
    let tv2 = tv.rotate(-Math.PI * 3 / 4);

    let p3 = c1.sub(tv);
    let p4 = c1.sub(tv2);

    let p5 = c2.add(tv2);
    let p6 = c2.add(tv);

    let p7 = p1.addH(w - g);
    let p8 = p0.addH(w);

    let rg = new Vector(g);
    let rt = new Vector(t * Math.tan(Math.PI * 3 / 8));

    let tabPath = `M${p0}L${p1}A${rg},0,0,1,${p2}L${p3}A${rt},0,0,1,${p4}L${p5}A${rt},0,0,0,${p6}L${p7}A${rg},0,0,1,${p8}Z`

    let p9 = p8.addV(h - 3 * g);
    let p10 = p9.add(-g, g);

    let p11 = p10.addH(2 * g - w);
    let p12 = p11.sub(g);

    let card = `M${p8.addV(-0.1)}L${p9}A${rg},0,0,1,${p10}L${p11}A${rg},0,0,1,${p12}L${p0.addV(-0.1)}Z`
    let outline = `M${p0}L${p1}A${rg},0,0,1,${p2}L${p3}A${rt},0,0,1,${p4}L${p5}A${rt},0,0,0,${p6}L${p7}A${rg},0,0,1,${p8}L${p9}A${rg},0,0,1,${p10}L${p11}A${rg},0,0,1,${p12}Z`;
    return  `<path class = "card" d = "${card}" />
             <path class = "tab" d = "${tabPath}" />
             <path stroke-width = "${border}" class = "outline" d = "${outline}" />`
}

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

function parseCardType(type) {
    let isTopic = null;
    let colorTheme = null;

    if (typeof type === "string") {
        isTopic = false;
        let parts = type.split("-");
        if (parts.length > 1 && parts[0] === "topic") {
            isTopic = true;
            colorTheme = parts[1];
        } else if (parts.length == 1) {
            if (type === "topic") {
                colorTheme = "topic";
                isTopic = true;
            } else {
                colorTheme = type;
            }
        }
    }

    return {isTopic, colorTheme};
}


const COLOR_THEMES = {
    lightRed: {
        "--main": "hsl(0, 100%, 89%)",
        "--tab": "hsl(0, 56%, 64%)"
    },
    darkRed: {
        "--main": "hsl(0, 70%, 38%)",
        "--tab": "hsl(0, 56%, 28%)",
        "--text": "white"
    },
    lightOrange: {
        "--main": "hsl(30, 100%, 85%)",
        "--tab": "hsl(30, 70%, 55%)"
    },
    darkOrange: {
        "--main": "hsl(30, 80%, 45%)",
        "--tab": "hsl(30, 70%, 35%)",
        "--text": "white"
    },
    lightGold: {
        "--main": "hsl(42, 100%, 81%)",
        "--tab": "hsl(42, 70%, 55%)"
    },
    darkGold: {
        "--main": "hsl(42, 75%, 48%)",
        "--tab": "hsl(42, 70%, 38%)",
        "--text": "white"
    },
    lightGreen: {
        "--main": "hsl(108, 100%, 83%)",
        "--tab": "hsl(108, 70%, 62%)"
    },
    darkGreen: {
        "--main": "hsl(95, 50%, 40%)",
        "--tab": "hsl(95, 50%, 30%)",
        "--text": "white"
    },
    lightTeal: {
        "--main": "hsl(150, 100%, 85%)",
        "--tab": "hsl(150, 70%, 55%)"
    },
    darkTeal: {
        "--main": "hsl(150, 90%, 33%)",
        "--tab": "hsl(150, 90%, 23%)",
        "--text": "white"
    },
    lightBlue: {
        "--main": "hsl(190, 100%, 85%)",
        "--tab": "hsl(190, 70%, 55%)"
    },
    darkBlue: {
        "--main": "hsl(190, 85%, 33%)",
        "--tab": "hsl(190, 85%, 23%)",
        "--text": "white"
    },
    lightIndigo: {
        "--main": "hsl(220, 100%, 89%)",
        "--tab": "hsl(220, 70%, 55%)"
    },
    darkIndigo: {
        "--main": "hsl(220, 50%, 45%)",
        "--tab": "hsl(220, 50%, 35%)",
        "--text": "white"
    },
    lightPurple: {
        "--main": "hsl(270, 100%, 91%)",
        "--tab": "hsl(270, 70%, 55%)"
    },
    darkPurple: {
        "--main": "hsl(270, 35%, 45%)",
        "--tab": "hsl(270, 35%, 35%)",
        "--text": "white"
    },
    action: {
        "--main": "hsla(11, 100%, 33%, 1.00)",
        "--main-hover": "hsla(11, 100%, 23%, 1.00)",
        "--main-active": "hsla(11, 96%, 18%, 1.00)",
        "--tab": "hsla(11, 100%, 25%, 1.00)",
        "--tab-hover": "hsla(11, 100%, 15%, 1.00)",
        "--tab-active": "hsla(11, 92%, 9%, 1.00)",
        "--icon-color": "hsl(0, 5%, 96%)",
        "--icon-color-hover": "white",
        "--text": "white",
    },
    white: {
        "--main": "hsl(0, 0%, 100%)",
        "--tab": "hsl(0, 0%, 90%)",
        "--text": "black",
        "--outline": "hsla(0, 1%, 14%, 1.00)"
    },
    topic: {
        "--main": "hsl(35, 100%, 84%)",
        "--tab": "hsl(35, 63%, 56%)",
        "--text": "black",
    },
    normal: {
        "--main": "hsl(211, 100%, 83%)",
        "--tab": "hsl(211, 70%, 62%)"
    },
    starter: {
        "--main": "hsl(102, 74%, 76%)",
        "--tab": "hsl(102, 70%, 61%)"
    },
    noun: { 
        "--main": "hsl(257, 100%, 89%)",
        "--tab": "hsl(257, 56%, 64%)"
    },
    adjective: {
        "--main": "hsl(47, 100%, 79%)",
        "--tab": "hsl(47, 57%, 54%)"
    },
    verb: {
        "--main": "hsl(353, 100%, 81%)",
        "--tab": "hsl(353, 68%, 66%)"
    },
    emphasis: {
        "--main": "hsl(18, 77%, 50%)",
        "--tab": "hsl(18, 86%, 41%)",
        "--text": "white",
        "--icon-color": "hsl(0, 5%, 96%)",
        "--icon-color-hover": "white",
    }
}

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

/** A GridIconSymbol represents the image from a grid icon. */
export class GridIconSymbol extends SvgPlus{
    constructor(symbol, useBackgroundImg = false){
        super("div");
        this.class = "symbol";

        if (typeof symbol == "string" && isIconName(symbol)) {
            this.createChild(Icon, {}, symbol)
        } else {
            let url = symbol;
            let maxWidth = 100;
            if (typeof symbol == "object" && symbol !== null && "url" in symbol) {
                url = symbol.url;
                if ("width" in symbol && typeof symbol.width === "number") {
                    maxWidth = symbol.width;
                }
            }

            if (typeof url === "string") {
                if (useBackgroundImg) {
                    this.createChild("div", {
                        class: "bg-img",
                        style: {
                            "background-image": `url(${symbol.url})`,
                            "max-width": `${90 * (maxWidth / 100)}%`
                        }
                    });
                } else {
                    this.createChild("img", {
                        styles: {
                            "max-width": `${90 * (maxWidth / 100)}%`
                        },
                        events: {
                            load: () => this.dispatchEvent(new Event("load")),
                            error: () => this.dispatchEvent(new Event("load")),
                        },
                        src: url
                    });
                }
            } else if ("text" in symbol) {
                this.createChild("div", {
                    class: "text",
                    content: symbol.text,
                    style: {
                        "font-size": symbol.size || null
                    }
                });
            }
        }
        this.isLoaded = true;
    }
}

export class GridCard extends SvgPlus { 
    constructor(el, type) {
        super(el);
        this.class = "grid-icon";

        this.type = type;

        let {isTopic, colorTheme} = parseCardType(type);
        this.styles = COLOR_THEMES[colorTheme] || COLOR_THEMES["normal"];

        this.cardIcon = this.createChild("svg", {class: "card-icon"});
        this.content = this.createChild("div", {class: "content"});

        if (isTopic !== null) {
            this.cardRenderer = isTopic ? folderCard : plainCard;
            let rs = new ResizeObserver(this.onresize.bind(this));
            rs.observe(this);
        }
    }

    /** @param {boolean} disabled */
    set disabled(disabled) {
        this.toggleAttribute("i-disabled", disabled);
        this._disabled = disabled;
    }

    /** @return {boolean} */
    get disabled() {
        return this._disabled;
    }

    /** @param {string} type */
    set type(type) {
        this._type = type;
        this.classList.remove(this.type);
        this.classList.add(type);
    }

    get type(){
        return this._type
    }

     // Called when the size of the icon changes.
    onresize(e){
        let bbox = e[0]?.contentRect;
        if (bbox) {
            let {width, height} = bbox;
            if (width > 0 && height > 0) {
                let size = new Vector(width, height);
                this.cardIcon.props = {
                    viewBox: `0 0 ${size.x} ${size.y}`,      // Update the svg viewBox.
                    content: this.cardRenderer(size) // Recompute the svg content.
                }
            }
        }
    }
}

/** A GridIcon represents an item from a topic. */
export class GridIcon extends GridCard {
    symbolLoaded = false;

    /** @type {?MarkdownElement} */
    subtitleElement = null;

    /** @type {MarkdownElement} */
    displayValueElement = null;

    /** @param {GridIconOptions} item */
    constructor(item, accessGroup) {
        try {
            super("access-button", item.type);
        } catch (e) {
            console.error("Error creating GridIcon with type:", item);
            throw e;
        }
        this.group = accessGroup || "default";
        this.item = item;
    
        // Toggle attribute 'i-hidden' if icon is hidden.
        this.toggleAttribute("i-hidden", !!item.hidden);


        // Add symbol to content box.
        if ("symbol" in item) {
           this.symbol = item.symbol;
        } else {
            this.symbolLoaded = true;
        }
        
        // Add text box with display value to content box.
        this.displayValueElement = this.makeDisplayValueElement();
        this.displayValue = item.displayValue || "";

        this.subtitle = item.subtitle;
       
        this.disabled = item.disabled || false;

        if ("events" in item) {
            this.events = item.events;
        }
    }

    makeSubtitleElement() {
        return this.content.createChild(MarkdownElement, {class: "subtitle"}, "div");
    }

    makeDisplayValueElement() {
        return this.content.createChild(MarkdownElement, {class: "display-value"}, "div");
    }

    set(item) {
        for (let key of ["symbol", "displayValue", "subtitle", "hidden", "disabled"]) {
            if (key in item) {
                this[key] = item[key];
            }
        }
    }
    

    /** @param {IconSymbol} symbol*/
    set symbol(symbol) {
        this._symbol = symbol;
        if (symbol !== null && symbol !== undefined) {
            let newSymbol = new GridIconSymbol(symbol);
            if (this.symbolElement) {
                this.content.replaceChild(newSymbol, this.symbolElement);
            } else {
                this.content.prepend(newSymbol)
            }
            this.symbolElement = newSymbol;
            this.symbolLoaded = newSymbol.isLoaded;
            this.symbolElement.addEventListener("load", () => {
                this.symbolLoaded = true;
                if (this.onload instanceof Function) this.onload();
                this.dispatchEvent(new Event("load"));
            });
        } else {
            if (this.symbolElement) {
                this.symbolElement.remove();
            }
            this.symbolElement = null;
            this.symbolLoaded = true;
        }
    }

    get symbol() {
        return this._symbol;
    }

    /** @param {boolean} hidden */
    set hidden(hidden) {
        this._hidden = hidden;
        this.toggleAttribute("i-hidden", hidden);
    }

    get hidden() {
        return this._hidden;
    }

    /** @param {string} value */
    set subtitle(value) {
        this._subtitle = value;
        if (value === null || value === undefined) {
            if (this.subtitleElement) {
                this.subtitleElement.remove();
                this.subtitleElement = null;
            }
        } else {
            if (!this.subtitleElement) {
                this.subtitleElement = this.makeSubtitleElement();
            }
            this.subtitleElement.set(value);

        }
    }
    get subtitle() {
        return this._subtitle;
    }   


    /** @param {string} value */
    set displayValue(value) {
        this._displayValue = value;
        this.displayValueElement.set(value);
    }
    get displayValue() {
        return this._displayValue;
    }

    /** Can be used to wait for the grid symbol image to load.
     *  @return {Promise<void>}
     * */ 
    async waitForLoad(){
        if (!this.loaded) {
            await new Promise((r) => this.onload = () => r());
        }
    }
   
    static get styleSheet(){
        return relURL("./grid-icon.css", import.meta);
    }
}

/**
 * A GridLayout represents a grid of GridIcons.
 * It allows adding GridIcons to specific rows and columns.
 * @extends SvgPlus
*/
export class GridLayout extends SvgPlus {
    /**
     * @param {number} rows - Number of rows in the grid.
     * @param {number} cols - Number of columns in the grid.
     */
    constructor(rows, cols) {
        super("grid-layout");
        if (typeof rows === "number" && typeof cols === "number") {
            this.elements = new Array(rows).fill(0).map(() => new Array(cols).fill(null));
            this.styles = {
                "grid-template-rows": `repeat(${rows}, 1fr)`,
                "grid-template-columns": `repeat(${cols}, 1fr)`,
                "--rows": rows,
                "--cols": cols
            }
        }
    }

    /**
     * Adds an item to the grid at the specified row and column.
     * @param {GridIcon|SvgPlus} item - The item to add to the grid.
     * @param {number} row - The starting row index (0-based).
     * @param {number} col - The starting column index (0-based).
     * @param {number} [rowEnd] - The ending row index (0-based, inclusive).
     * @param {number} [colEnd] - The ending column index (0-based, inclusive).
     */
    add(item, row, col, rowEnd = row, colEnd = col) {
        if (SvgPlus.is(item, SvgPlus) && typeof row === "number" && typeof col === "number") {
            rowEnd = typeof rowEnd === "number" ? rowEnd+1 : row;
            colEnd = typeof colEnd === "number" ? colEnd+1 : col;
            item.styles = {
                "grid-row-start": row + 1,
                "grid-column-start": col + 1,
                "grid-row-end": rowEnd + 1,
                "grid-column-end": colEnd + 1
            }

            
            // for (let r = row; r < rowEnd; r++) {
            //     for (let c = col; c < colEnd; c++) {
            //         this.elements[r][c] = item;
            //     }
            // }
            this.appendChild(item);
        }
    }
}