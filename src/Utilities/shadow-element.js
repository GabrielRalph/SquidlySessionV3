import { SvgPlus } from "../SvgPlus/4.js";

let LOADED_STYLES = {};

export class ShadowElement extends SvgPlus {
    constructor(el) {
        super(el);
        this.attachShadow({mode: "open"});
        let root = new SvgPlus("shadow-root-element");
        root.styles = {
            display: "block",
            width: "100%",
            height: "100%",
            position: "relative",
        }
        this._root = this.shadowRoot.appendChild(root);
    }

    async waitStyles(){
        if (this._stylesProm instanceof Promise) {
            await this._stylesProm
        }
    }

    async loadStyles(url) {
        this._stylesProm = ShadowElement.loadStyleSheets(url);
        let styles = await this._stylesProm
        this.shadowRoot.adoptedStyleSheets = styles;
        return styles;
    }

    static async loadStyleSheets(url){
        if (typeof url === "string") url = [url];
        let proms = url.map(async a => {
            if (a in LOADED_STYLES) {
                return LOADED_STYLES[a]
            } else {
                let res = await fetch(a);
                let text = await res.text();
                let style = new CSSStyleSheet();
                style.replaceSync(text);
                LOADED_STYLES[a] = style;
                return style;
            }
        });

        let styles = await Promise.all(proms);
        return styles;
    }

    get root() {return this._root;}
}

