import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { AccessButton } from "./access-buttons.js";
import { Icon, isIconName } from "./Icons/icons.js";
import { relURL } from "./usefull-funcs.js";


/**
 * @typedef {string | {url: string}} IconSymbol
 */

/**
 * @typedef {Object} GridIconOptions
 * @param {("topic"|"normal"|"starter"|"noun"|"verb"|"adjective"|"action"|"topic-normal"|"topic-starter"|"topic-verb"|"topic-adjective")} type
 * @param {string} displayValue 
 * @param {symbol} [symbol]
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

const MAKE_CARD_ICON = {
    topic: folderCard,
    "topic-normal": folderCard,
    "topic-starter": folderCard,
    "topic-noun": folderCard,
    "topic-verb": folderCard,
    "topic-adjective": folderCard,
    "topic-action": folderCard,
    normal: plainCard,
    starter: plainCard,
    noun: plainCard,
    verb: plainCard,
    adjective: plainCard,
    action: plainCard,
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
            if (typeof symbol == "object" && symbol !== null && "url" in symbol) {
                url = symbol.url;
            }

            if (typeof url === "string") {
                if (useBackgroundImg) {
                    this.createChild("div", {
                        class: "bg-img",
                        style: {
                            "background-image": `url(${symbol.url})`
                        }
                    });
                } else {
                    this.createChild("img", {
                        events: {
                            load: () => this.dispatchEvent(new Event("load")),
                            error: () => this.dispatchEvent(new Event("load")),
                        },
                        src: symbol.url
                    });
                }
            } else if ("text" in symbol) {
                this.createChild("div", {
                    class: "text",
                    content: symbol.text
                });
            }
        }
        this.isLoaded = true;
    }
}

/** A GridIcon represents an item from a topic. */
export class GridIcon extends AccessButton {
    symbolLoaded = false;

    /** @param {GridIconOptions} item */
    constructor(item, accessGroup) {
        super(accessGroup);
        this.item = item;

        // Set class to type
        this.class = "grid-icon";

        this.type = item.type;

        // Toggle attribute 'i-hidden' if icon is hidden.
        this.toggleAttribute("i-hidden", !!item.hidden);

        // Create card background svg, and icon content box.
        this.cardIcon = this.createChild("svg", {class: "card-icon"});
        this.content = this.createChild("div", {class: "content"});

        // Add symbol to content box.
        if ("symbol" in item) {
           this.symbol = item.symbol;
        } else {
            this.symbolLoaded = true;
        }
        
        // Add text box with display value to content box.
        this.displayValueElement = this.content.createChild("div", {class: "display-value"});
        this.displayValue = item.displayValue || "";

        if ("subtitle" in item) {
            this.subtitleElement = this.content.createChild("div", {class: "subtitle"});
            this.subtitle = item.subtitle;
        }
        // Set up resize observer to re render the card when the size of the 
        // grid icon changes.
        if (this.item.type in MAKE_CARD_ICON) {
            let rs = new ResizeObserver(this.onresize.bind(this));
            rs.observe(this);
        }

        this.disabled = item.disabled || false;
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

    /** @param {string} type */
    set type(type) {
        this._type = type;
        this.classList.remove(this.type);
        this.classList.add(type);
    }

    get type(){
        return this._type
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
            if (this.subtitleElement) {
                this.subtitleElement.innerHTML = value;
            } else {
                this.subtitleElement = this.content.createChild("div", {content: value, class: "subtitle"});
            }
        }
    }
    get subtitle() {
        return this._subtitle;
    }   


    /** @param {string} value */
    set displayValue(value) {
        this._displayValue = value;
        this.displayValueElement.innerHTML = value;
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

    // Called when the size of the icon changes.
    onresize(e){
        let bbox = e[0]?.contentRect;
        if (bbox) {
            let {width, height} = bbox;
            if (width > 0 && height > 0) {
                let size = new Vector(width, height);
                this.cardIcon.props = {
                    viewBox: `0 0 ${size.x} ${size.y}`,      // Update the svg viewBox.
                    content: MAKE_CARD_ICON[this.type](size) // Recompute the svg content.
                }
            }
        }
    }

    static get styleSheet(){
        return relURL("./grid-icon.css", import.meta);
    }
}
