import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm'
import { SvgPlus } from '../../SvgPlus/4.js';

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
        }, 50)        
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

export class MarkdownElement extends SvgPlus {
    constructor(el, content, multi = false){
        super(el)
        this.loading = this.typeset(content, multi);
    }

    async typeset(content, multi){
        if (typeof content === "string" && content.length > 0) {
            let [contentTokenised, tokens] = tokeniseMath(content);
    
            let html = markdown(contentTokenised, multi);
    
            for (let token of tokens) {
                html = html.replace(...token)
            }
    
            this.innerHTML =  html
            await loadingProm;        
            await MathJax.typeset([this])        
        } else {
            this.innerHTML = "";
        }
    }
}