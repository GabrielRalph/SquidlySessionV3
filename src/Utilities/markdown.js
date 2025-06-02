import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm'
import { SvgPlus } from '../SvgPlus/4.js';

const MD = new markdownIt();
const JaxSetup = document.createElement("script");
JaxSetup.innerHTML = `
MathJax = {
        loader: {load: ['[tex]/color', '[tex]/colortbl']},
        tex: {
            packages: {'[+]': ['color', 'colortbl']},
            inlineMath: [['$$', '$$']],
            displayMath: [],
            macros: {
            trans:"\\\\underset{heat}{\\\\overset{cool}{\\\\rightleftharpoons}}",
            mat: ["\\\\left[ \\\\begin{matrix} #1 \\\\end{matrix}\\\\right]", 1],
            abs: ["\\\\left| \\\\ #1 \\\\right|", 1],
            dpar: ["\\\\cfrac{\\\\partial #1}{\\\\partial #2}", 2],
            hl: ["{\\\\color{WildStrawberry} #1}", 1],
            red: ["{\\\\color{BrickRed} {#1}}", 1],
            blue: ["{\\\\color{RoyalBlue} {#1}}", 1],
            mod: ["\\\\ (\\\\text{mod } {#1})", 1],
            },
            tags: "ams",
        },
        svg: {
            fontCache: 'global'
        }
    };
    `
document.body.appendChild(JaxSetup);
/** @type {HTMLScriptElement} */
const JaxScript = document.createElement("script");
JaxScript.setAttribute("type", "text/javascript")
let loadingProm = new Promise((r) => {
    JaxScript.addEventListener("load", () => {
        setTimeout(() => {
            r()
        }, 100)        
    })
})
// JaxScript.toggleAttribute("async");
JaxScript.setAttribute("src", "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js");
document.body.appendChild(JaxScript);

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
            tokens.push([token, "$"+text.slice(open, close)+"$"])

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
        mathjax: false,
        markdown: false,
        multi: false
    }
    if (typeof mode === "object" && mode !== null) {
        for (let key in modeParsed) {
           if (key in mode) modeParsed[key] = mode[key];
        }
    } else if (typeof mode === "string") {
        if (mode === "mathjax") {
            modeParsed.mathjax = true;
        } else if (mode === "markdown") {
            modeParsed.markdown = true;
        } else if (mode === "both") {
            modeParsed.mathjax = true;
            modeParsed.markdown = true;
        } else if (mode === "both-multi") {
            modeParsed.mathjax = true;
            modeParsed.markdown = true;
            modeParsed.multi = true;
        } 
    } else if (mode === true) {
        modeParsed.markdown = true;
        modeParsed.mathjax = true;
    } 


    return modeParsed
}

export class MarkdownElement extends SvgPlus {
    constructor(el, mode = false){
        super(el)
        this.markdownMode = mode;
    }

    set markdownMode(mode) {
        this._markdownMode = parseMode(mode);
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

    adjustFS() {
        window.requestAnimationFrame(() => {
            let els = this.querySelectorAll("*")
            let bboxes = [...els].map(el => el.getBoundingClientRect())
            let maxWidth = Math.max(...bboxes.map(bbox => bbox.width));
            let {width, height} = this.getBoundingClientRect();
            
            if (maxWidth > width) {
                let ratio =  width / (maxWidth);
                let aspect = ((height/width) - 1) * 0.1;

                // console.log(ratio, aspect);
                ratio += aspect;
                
                this.styles = {
                    "font-size": `${ratio.toFixed(3)}em`
                }
            }
        })
    }

    async set(content){
        let math = false;
        if (typeof content === "string" && content.length > 0) {
            if (this.markdownMode.mathjax && this.markdownMode.markdown) {
                let [contentTokenised, tokens] = tokeniseMath(content);
        
                let html = markdown(contentTokenised, this.markdownMode.multi);
        
                for (let token of tokens) {
                    html = html.replace(...token)
                }
                this.innerHTML =  html
                math = true;
                
            } else if (this.markdownMode.markdown) {
                this.innerHTML = markdown(content, this.markdownMode.multi);
            } else if (this.markdownMode.mathjax) {
                this.textContent = content;
                math = true;
            } else {
                this.innerHTML = content;
            }      

            if (math) {
                await loadingProm;        
                if (MathJax) {
                    await MathJax.typeset([this]) 
                }
            }
        } else {
            this.innerHTML = "";
        }
    }
}