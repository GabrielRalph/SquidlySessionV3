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


export class ShadowElement extends SvgPlus {
    constructor(el, name = el) {
        super(el);
        this.attachShadow({mode: "open"});
        this.loadStyles();
        let root;
        if (typeof name === "string") {
            root = new SvgPlus(name);
        } else if (SvgPlus.is(name, SvgPlus)) {
            root = name;
        }

        root.toggleAttribute("shadow");
        this.shadowRoot.appendChild(root);
        this._root = root;
    }

    appendChild(...args) {
        return this.root.appendChild(...args);
    }

    createChild(...args) {
        return this.root.createChild(...args);
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

    get root() {return this._root;}
}

