import { SvgPlus } from "../SvgPlus/4.js";
import { delay } from "./usefull-funcs.js";

let LOADED_STYLES = {};
// console.log({CSSStyleSheet});

let isCSSConstructor = true;
let StylesPolyfilElement = null
try {
    let a = new CSSStyleSheet();
} catch (e) {
    isCSSConstructor = false;
    let styleDump = new SvgPlus("style-dump");
    styleDump.styles = {display: "none"};
    styleDump.attachShadow({mode: "open"});
    document.body.appendChild(styleDump);
    StylesPolyfilElement = styleDump;
}


async function newCSSStyleSheet(text) {
    if (isCSSConstructor) {
        let style = new CSSStyleSheet()
        style.replaceSync(text);
        return style;
    } else {
        let styleSheetMaker = () => {
            let style = document.createElement("style")
            style.innerHTML = text;
            return style;
        }
        return styleSheetMaker;
    }
}

/**
 * @template {SvgPlus} RootElementType
 */
export class ShadowElement extends SvgPlus {
    /**
     * @param {string | Element} el element or tag name to be used as the root of the shadow element.
     * @param {string | RootElementType} name element or tag name to be used as the root of the shadow element. If a string is provided, an SvgPlus element with that tag name will be created and used as the root. If an SvgPlus element is provided, it will be used directly as the root. If not provided, the element created from `el` will be used as the root.
     */
    constructor(el, name = el) {
        super(el);
        this.attachShadow({mode: "open"});
        this.loadStyles();
        let root;
        if (typeof name === "string") {
            this._root = /** @type {RootElementType} */ new SvgPlus(name);
        } else if (SvgPlus.is(name, SvgPlus)) {
            this._root = name;
        }

        this._root.toggleAttribute("shadow");
        this.shadowRoot.appendChild(this._root);
    }

    appendChild(...args) {
        return this.root.appendChild(...args);
    }

    /** Creates a child SvgPlus element, sets its properties and appends it to its root element
     * @template {new (...args: any[]) => SvgPlus} T
     * @overload
     * @param {T} type class definition of the element to be created.
     * @param {Props} props properties to be set on the element before it is appended to the DOM.
     * @param {...any} args arguments to be passed to the constructor of the class definition provided in type.
     * @returns {InstanceType<T>}
     */
    /** Creates a child SvgPlus element, sets its properties and appends to its root element
     * @overload
     * @param {ElementLike} type tag name of the element to be created.
     * @param {Props} props properties to be set on the element before it is appended to the DOM.
     * @returns {SvgPlus}
     */
    /** Creates a child SvgPlus element, sets its properties and appends to its root element
     * @template {new (...args: any[]) => SvgPlus} T 
     * @param {ElementLike | T} type type Can be provided as an element tag name or an SvgPlus class.
     * @param {Props} props props element properties will be set before appending the newly created element.
     * @param {...any} args args if a type is given as an SvgPlusClass then the params will be passed to the 
     *                      constructor of that class when constructing the element.
     * @return {SvgPlus | InstanceType<T>}
     */
    createChild(type, props = {}, ...args) {
        return this.root.createChild(type, props, ...args);
    }

    async waitStyles(){
        if (this._stylesProm instanceof Promise) {
            await this._stylesProm
        }
    }

    async loadStyles(url = this.usedStyleSheets) {
        this._stylesProm = ShadowElement.loadStyleSheets(url);
        let styles = await this._stylesProm;

        if (isCSSConstructor) {
            this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, ...styles];
        } else {
            for (let style of styles) {
                this.shadowRoot.appendChild(style())
            }
        }
        return styles;
    }

    static async loadStyleSheets(urls = this.usedStyleSheets){
        let styles = []
        if (typeof urls === "string") urls = [urls];
        if (Array.isArray(urls)) {
            let proms = [...new Set(urls)].map(async url => {
                if (!(url in LOADED_STYLES)) {
                    let prom = async () => {
                        try {
                            let res = await fetch(url);
                            let text = await res.text();
                            let style = await newCSSStyleSheet(text)
                            return style;
                        } catch (e) {
                            console.warn(`Failed to load style sheet: ${url}`, e);
                            return null;
                        }
                    }
                    LOADED_STYLES[url] = prom();
                }
                return LOADED_STYLES[url]
            });
            styles = await Promise.all(proms);
        }

        return styles;
    }

    static get usedStyleSheets(){
        return []
    }

    get usedStyleSheets() {
        return this["__+"].usedStyleSheets
    }

    /** @returns {RootElementType} */
    get root() {return this._root;}
}

