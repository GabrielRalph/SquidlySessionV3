import { SvgPlus, Vector} from "../../SvgPlus/4.js"
import { IconSourceText } from "./icons-library.js";

/**
 * @typedef IconInfo
 * @type {object}
 * @property {string} html - innerHTML of svg icon.
 * @property {string} viewBox - viewBox of svg icon.
 * @property {number} ws - old used to size icon.
 */

/**
 * @type {Object.<string, IconInfo>}
 */
let IconsParsed = {
}



/**
 * @typedef {import('./icons-library.js').IconName} IconName
 */
const DEFAULT_HEIGHT = 17.5;
for (let name in IconSourceText) {
  try {
    let svgString = IconSourceText[name];
    let svg = SvgPlus.parseSVGString(svgString);
    for (let e of svg.querySelectorAll("defs, style, script")) e.remove();

    for (let e of svg.querySelectorAll("*")) {
      if (e instanceof SVGGeometryElement) {
        e.removeAttribute("class");
        if (e.hasAttribute("stroke")) {
            e.classList.add('i-stroke')
        } else if (e.getAttribute("fill") !== "none") {
            e.classList.add("i-fill");
        }
        e.classList.add(e.getAttribute("id"));
        e.removeAttribute("id")
      }
    }

    let vb = svg.getAttribute("viewBox")
  
    let h = parseFloat(vb.split(" ")[3]);
    IconsParsed[name] = {
        viewBox: vb,
        ws: Math.round(1000*h/DEFAULT_HEIGHT)/1000,
        html: svg.innerHTML
    }
  } catch(e) {
    console.log(name, e);
  }

}

const DEFAULT_ICON_STYLE = `
    .icon .i-fill {fill: var(--icon-color)}
    .icon .i-stroke {stroke: var(--icon-color)}
    .icon:hover .i-fill {fill: var(--icon-color-hover)}
    .icon:hover .i-stroke {stroke: var(--icon-color-hover)}
    .icon {height: 1em; cursor: pointer;}
`
export function isIconName(name) {
    return name in IconsParsed;
}

export class Icon extends SvgPlus {
    /**
     * @param {IconName} name
     */
    constructor(name, isSquare = true) {
        super("svg")
        this.class = "icon"
        this.isSquare = isSquare;
        this.name = name;
        this.watchMutations({
            attributes: true, 
            attributeFilter: ["name"], 
            subtree: false
        }, () => {this.name = this.getAttribute("name")});
        let rs = new ResizeObserver(() => {
            let [pos, size] = this.svgBBox;
            let a = size.x * size.y;
            if (a > 1e-5) {
                this.squareViewBox();
                rs.disconnect();
            }
            
        })
        rs.observe(this);
    }


    squareViewBox() {
        this.styles = {
            opacity: 0,
        }
        // window.requestAnimationFrame(() => {
            let [pos, size] = this.svgBBox;
            let maxDim = Math.max(size.x, size.y);
            let newSize = new Vector(maxDim/0.9);
            let newPos = pos.add(size.sub(newSize).div(2))
            
            this.props = {
                viewBox: `${newPos.x} ${newPos.y} ${newSize.x} ${newSize.y}`
            }
            this.styles = {
                opacity: null,
            }
        // })
    }
    

    /** 
     * @param {IconName} name
     */
    set name(name){
        if (name === this._name) return;
        this._name = name;
        
        if (name in IconsParsed) {
            let ws = IconsParsed[name].ws;
            this.styles = {
                "--ws": ws,
                opacity: 0
            }
            this.props = {
                name: name,
                viewBox: IconsParsed[name].viewBox,
                content: IconsParsed[name].html,
            }
        } else {
            this.props = {
                name: null,
                viewBox: "0 0 0 0",
                content: ""
                
            }
        }
        this.styleElement = this.createChild("style", {content: DEFAULT_ICON_STYLE})

        if (this.isSquare) {
            this.squareViewBox();
        } else {
            this.styles = {opacity: null}
        }

        if (this.onrender instanceof Function) {
            this.onrender();
        }
    }
}