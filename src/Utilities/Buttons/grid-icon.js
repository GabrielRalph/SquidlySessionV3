import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { Icon, isIconName } from "../Icons/icons.js";
import { MarkdownElement } from "../markdown.js";
import { relURL } from "../usefull-funcs.js";

/**
 * GridIconSymbol can be a string or an object defining the icon symbol.
 * If a string, it can be an icon name or a URL.
 * If an object, it can have a 'url' property for the image URL or a 'text' property for text content.
 * @typedef {import("../Icons/icons-library.js").IconName | {url: string} | {text: string}} IconSymbol
 * @see /Utilities/Icons/icons-library.js
 */

/**
 * @typedef {Object} GridIconOptions
 * @property {import("./color-theme.js").GridIconTypes} type - The type of the icon, which determines its appearance. 
 *                           general type format: [topic-]colorTheme
 *                           see COLOR_THEMES for available color themes.
 * @property {string} displayValue - The text to display below the icon.
 * 
 * @property {string} [subtitle] - The icon symbol, can be a string or an object with a url.
 * @property {IconSymbol} [symbol] - The icon symbol, see above.
 * @property {boolean} [hidden] - If true, the icon will be hidden.
 * @property {boolean} [disabled] - If true, the icon will be disabled and slightly see through.
 * @property {boolean} [displayOnly] - If true, the icon will not be interactive.
 * @property {Object.<string, Function>} [events] - An object mapping event names to event handler functions.
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

// function parseCardType(type) {
//     let isTopic = null;
//     let colorTheme = null;

//     if (typeof type === "string") {
//         isTopic = false;
//         let parts = type.split("-");
//         if (parts.length > 1 && parts[0] === "topic") {
//             isTopic = true;
//             colorTheme = parts[1];
//         } else if (parts.length == 1) {
//             if (type === "topic") {
//                 colorTheme = "topic";
//                 isTopic = true;
//             } else {
//                 colorTheme = type;
//             }
//         }
//     }

//     return {isTopic, colorTheme};
// }


/** A GridIconSymbol represents the image from a grid icon. */
export class GridIconSymbol extends SvgPlus{
    /** 
     * @param {IconSymbol} symbol
     * @param {boolean} [useBackgroundImg=false] - If true, use a background image instead of an img element.
     * */
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

        this.cardIcon = this.createChild("svg", {class: "card-icon"});
        this.content = this.createChild("div", {class: "content"});

        const isTopic = type && type.startsWith("topic");
       
        this.cardRenderer = isTopic ? folderCard : plainCard;
        let rs = new ResizeObserver(this.onresize.bind(this));
        rs.observe(this);
    }

    /** 
     * Disables pointer events and applies disabled styles to the icon.
     * @param {boolean} displayOnly 
     * */
    set displayOnly(displayOnly) {
        this.toggleAttribute("i-display-only", displayOnly);
    }

    /** @return {boolean} */
    get displayOnly() {
        return this.hasAttribute("i-display-only");
    }

    /** 
     * Disables the active effect on the icon, which normally changes the icon's appearance when clicked.
     * @param {boolean} type 
     * */
    set disableActiveEffect(disable) {
        this.toggleAttribute("i-disable-active", disable);
    }

    /** @return {boolean} */
    get disableActiveEffect() {
        return this.hasAttribute("i-disable-active");
    }
    
    /** 
     * Disables the hover effect on the icon, which normally changes the icon's appearance when hovered over.
     * @param {boolean} disable */
    set disableHoverEffect(disable) {
        this.toggleAttribute("i-disable-hover", disable);
    }

    /** @return {boolean} */
    get disableHoverEffect() {
        return this.hasAttribute("i-disable-hover");
    }

    /** 
     * Disables the icon, making it non-interactive and applying disabled styles.
     * I.e. slightly see through and no active effect.
     * @param {boolean} disabled */
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
        this.setAttribute("type", type);
        // this.classList.remove(this.type);
        this._type = type;
        // this.classList.add(type);
        this.onresize();
    }

    get type(){
        return this._type
    }

     // Called when the size of the icon changes.
    onresize(e){
        if (!e) {
            e = [{contentRect: this.getBoundingClientRect()}];
        }
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
        return [bbox.width, bbox.height];
    }
}

/** A GridIcon represents an item from a topic. */
export class GridIcon extends GridCard {
    symbolLoaded = false;

    /** @type {?MarkdownElement} */
    subtitleElement = null;

    /** @type {MarkdownElement} */
    displayValueElement = null;

    /** 
     * @param {GridIconOptions} item 
     * @param {string} accessGroup
     * */
    constructor(item, accessGroup) {
        try {
            super("access-button", item.type);
        } catch (e) {
            console.error("Error creating GridIcon with type:", item);
            throw e;
        }
        this.group = accessGroup || item.accessGroup || "default";
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
        this.displayOnly = item.displayOnly || false;

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


    /**
     * Sets the markdown mode for the subtitle and display value elements, which determines how their content is rendered.
     * @param {boolean|string|object} mode - The markdown mode to set. Can be a boolean, a string, or an object.
     * If a boolean, true enables both math and markdown modes, while false disables both.
     * If a string, it can be "math", "markdown", "both", or "both-multi" to specify the modes to enable.
     * If an object, it can have boolean properties 'math', 'markdown', and 'multi' to specify the modes to enable.
     */
    set markdownMode(mode) {
        if (this.subtitleElement) {
            this.subtitleElement.markdownMode = mode;
        }
        if (this.displayValueElement) {
            this.displayValueElement.markdownMode = mode;
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


    set utterance(text) {
        this.utteranceText = text;
    }
    get utterance() {
        return this.utteranceText;
    }

    async speak() {
        await this.speakUtterance();
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


function parseCellPosition(rowStart, colStart, rowEnd = rowStart, colEnd = colStart) {
    if (Array.isArray(rowStart) && rowStart.length === 2) {
        [rowStart, rowEnd] = rowStart;
    }

    if (Array.isArray(colStart) && colStart.length === 2) {
        [colStart, colEnd] = colStart;
    }

    if (typeof rowStart === "number" && typeof colStart === "number") {
        rowEnd = typeof rowEnd === "number" ? rowEnd+1 : rowStart;
        colEnd = typeof colEnd === "number" ? colEnd+1 : colStart;

        return [rowStart, colStart, rowEnd, colEnd];
    } else {
        return [null, null, null, null];
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
        this.size = [rows, cols];
    }

    /**
     * Sets the size of the grid and updates the CSS grid template accordingly.
     * @param {[number, number]} size - An array containing the number of rows and columns, respectively.
     */
    set size([rows, cols]) {
        if (typeof rows === "number" && typeof cols === "number") {
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
     * 
     * @returns {GridIcon|SvgPlus} The added item.
     */
    add(item, ...posArgs) {
        let [row, col, rowEnd, colEnd] = parseCellPosition(...posArgs);

        if (SvgPlus.is(item, SvgPlus) && row !== null) {
            item.styles = {
                "grid-row-start": row + 1,
                "grid-column-start": col + 1,
                "grid-row-end": rowEnd + 1,
                "grid-column-end": colEnd + 1
            }
            this.appendChild(item);
        }

        return item;
    }

    addItemInstance(classDef, item, ...posArgs) {
        let instance = new classDef(item);
        return this.add(instance, ...posArgs);
    }

    /**
     * Adds a GridIcon to the grid at the specified row and column.
     * @param {GridIconOptions} item - The options for the GridIcon to add.
     * @param {number} row - The starting row index (0-based).
     * @param {number} col - The starting column index (0-based).
     * @param {number} [rowEnd] - The ending row index (0-based, inclusive).
     * @param {number} [colEnd] - The ending column index (0-based, inclusive).
     */
    addGridIcon(item, ...posArgs) {
        const gridIcon = new GridIcon(item);
        return this.add(gridIcon, ...posArgs);
    }


    /**
     * Adds multiple items to the grid at the specified starting row and column.
     * The items can be provided as a 2D array, where each sub-array represents a row of items.
     * @param {SvgPlus[][]|SvgPlus[]} items - A 2D array of GridIcon options or a flat array of GridIcon options.
     * @param {number} rowStart - The starting row index (0-based).
     * @param {number} colStart - The starting column index (0-based).
     * @param {number} [rowEnd] - The ending row index (0-based, inclusive).
     * @param {number} [colEnd] - The ending column index (0-based, inclusive).
     */
    addItems(items, ...posArgs) {
        if (Array.isArray(items)) {
            let valid = false;
            let items2 = items;
            if (items.every(i => SvgPlus.is(i, SvgPlus) || i == null)) {
                items2 = [items];
                valid = true;
            } else {
                valid = items2.every(row => Array.isArray(row) && row.every(i => SvgPlus.is(i, SvgPlus) || i == null));
            }

            if (valid) {
                let [rowStart, colStart] = parseCellPosition(...posArgs);
                items2.forEach((row, r) => {
                    row.forEach((item, c) => {
                        if (item) {
                            this.add(item, rowStart + r, colStart + c);
                        }
                    });
                });
            }
        }
        return items;
    }

    /**
     * Adds multiple GridIcons to the grid at the specified starting row and column.
     * The items can be provided as a 2D array, where each sub-array represents a row of items.
     * @param { import("../../SvgPlus/4.js").SvgPlusClass } classDef - The class definition to use for creating the items (e.g., GridIcon).
     * @param {any[][]|any[]} items - A 2D array of GridIcon options or a flat array of GridIcon options.
     * @param {number} rowStart - The starting row index (0-based).
     * @param {number} colStart - The starting column index (0-based).
     * @param {number} [rowEnd] - The ending row index (0-based, inclusive).
     * @param {number} [colEnd] - The ending column index (0-based, inclusive).
     */
    addItemInstances(classDef, items, ...posArgs) {
        let instances = items.map((item, r) => {
            if (item == null) return null;
            else if (Array.isArray(item)) {
                return item.map(i => i == null ? i : new classDef(i, "item-"+r));
            } else {
                return new classDef(item);
            }
        });
        this.addItems(instances, ...posArgs);
        return instances;
    }

    /**
     * Adds multiple GridIcons to the grid at the specified starting row and column.
     * The items can be provided as a 2D array, where each sub-array represents a row of items.
     * @param {GridIconOptions[][]|GridIconOptions[]} items - A 2D array of GridIcon options or a flat array of GridIcon options.
     * @param {number} rowStart - The starting row index (0-based).
     * @param {number} colStart - The starting column index (0-based).
     * @param {number} [rowEnd] - The ending row index (0-based, inclusive).
     * @param {number} [colEnd] - The ending column index (0-based, inclusive).
     */
    addGridIcons(items, ...posArgs) {
        return this.addItemInstances(GridIcon, items, ...posArgs);
    }
}