import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm'
import katex from "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.mjs";
import { SvgPlus } from '../SvgPlus/4.js';

const MD = new markdownIt();

 const macros = {
    "\\trans": "\\underset{heat}{\\overset{cool}{\\rightleftharpoons}}",
    "\\mat": "\\left[ \\begin{matrix} #1 \\end{matrix}\\right]",
    "\\abs": "\\left| \\ #1 \\right|",
    "\\dpar": "\\cfrac{\\partial #1}{\\partial #2}",
    "\\mod": "\\ (\\text{mod } {#1})",
};


function markdown(text, multi){
    let html;
    
    if (!multi) {
        html = MD.renderInline(text);
    } else {
        html = MD.render(text);
    }
    
    return html;
}

function tokeniseMath(text) {
    let matches = [...text.matchAll(/\$\$/g)];

    let si = 0;
    let strs = [];
    let tokens = []
    if (matches.length > 1) {
        for (let i = 0; i < matches.length; i+= 2) {
            let open = matches[i].index;
            let close = matches[i + 1].index + 2;
            let token = `!${(new Date).getTime()}${i}!`
            
            strs.push(text.slice(si, open));
            strs.push(token);
            tokens.push([token, text.slice(open + 2, close - 2)])

            si = close;
        }
        strs.push(text.slice(si, text.length))
    } else {
        strs = [text]
    }
    
    return [strs.join(""), tokens]
}

function parseMode(mode) {
    let modeParsed = {
        math: false,
        markdown: false,
        multi: false
    }
    if (typeof mode === "object" && mode !== null) {
        for (let key in modeParsed) {
           if (key in mode) modeParsed[key] = mode[key];
        }
    } else if (typeof mode === "string") {
        if (mode === "math") {
            modeParsed.math = true;
        } else if (mode === "markdown") {
            modeParsed.markdown = true;
        } else if (mode === "both") {
            modeParsed.math = true;
            modeParsed.markdown = true;
        } else if (mode === "both-multi") {
            modeParsed.math = true;
            modeParsed.markdown = true;
            modeParsed.multi = true;
        } 
    } else if (mode === true) {
        modeParsed.markdown = true;
        modeParsed.math = true;
    } 
    return modeParsed
}

const Canvas = new SvgPlus("canvas");
const Ctx = Canvas.getContext("2d");

export class MarkdownElement extends SvgPlus {
    constructor(el, mode = false){
        super(el)
        this.markdownMode = mode;
        this._lastFontSize = 1;
    }

    set markdownMode(mode) {
        this._markdownMode = parseMode(mode);
        this.set(this.content);
    }
    get markdownMode() {
        return this._markdownMode;
    }


    /**
     * @param {string} content
     */
    set content(content) {
        this.set(content);
    }

    /**
     * @return {string}
     */
    get content() {
        return this._content;
    }

    adjustFS() {

        if (!this.markdownMode.markdown && !this.markdownMode.math) {
            let width = this.clientWidth;
            let value = this.textContent;
            if (value !== "" && width > 0) {
                const font = getComputedStyle(this).font;
                Ctx.font = font;
                
                let wordWidths = value.split(" ").map(w => Ctx.measureText(w).width);
                let tWidth = Math.max(...wordWidths);
                let dWidth = width * 0.9;

                if (this._lastFontSize * dWidth / tWidth < 1) {
                    this.children[0].style.setProperty("font-size", `${dWidth / tWidth}em`);
                    this._lastFontSize = dWidth / tWidth;
                }
            }
        }
    }

    async set(content){
        if (typeof content === "string" && content.length > 0) {
            this._content = content;
            let contentTokenised = `<span>${content}</span>`;
            let tokens = [];

            if (this.markdownMode.math) {
                [contentTokenised, tokens] = tokeniseMath(content);
            }

            if (this.markdownMode.markdown) {
                contentTokenised = markdown(contentTokenised, this.markdownMode.multi);
            }

            if (this.markdownMode.math) {
                 for (let [id, math] of tokens) {
                    let mathml = "";
                    try {
                        mathml = katex.renderToString(math, {
                            throwOnError: false,
                            output: "mathml",
                            macros
                        })
                    } catch (e) {
                        console.error("Error parsing math:",math, e);
                    }
                    contentTokenised = contentTokenised.replace(id, mathml);
                }
            }

            this.innerHTML = contentTokenised;
           
        } else {
            this.innerHTML = "";
        }
    }
}