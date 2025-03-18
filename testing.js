import {SvgPlus} from "./src/SvgPlus/4.js"
import {SessionView} from "./src/SessionView/session-view.js"
import { ShadowElement } from "./src/Utilities/shadow-element.js";
import { Icon } from "./src/Utilities/Icons/icons.js";
import {ToolBarFeature} from "./src/Features/ToolBar/tool-bar.js";
let load = async () => {

}

const key2name = {
    "b": "bottomPanel",
    "t": "toolBarArea",
    "i": "topPanel",
    "s": "sideScreen",
    "c": "sidePanel",
}


class MyClass extends ShadowElement {
    constructor(isSide){
        super("my-class");

        let a = this.root.createChild("div", {class: "test" + (isSide ? " side" : "")});
        a.createChild("div", {class: "ok"})
    }

    static get usedStyleSheets(){
        return ["./test.css"]
    }
}

class AppsTest extends ShadowElement {
    constructor() {
        super("app-test")

        let row = this.root.createChild("div", {class: "row"});
        row.createChild("div", {content: "Some App"});
        row.createChild(Icon, {}, "close")
        this.root.createChild("div", {class: "cont"})
    }

    static get usedStyleSheets(){
        return ["./test.css"]
    }
}

class Buttons extends ShadowElement {
    constructor(sv) {
        super("my-buttons");

        this.root.class = "main"
        let a = this.root.createChild("div", {class: "flex-col"});
        for (let k in key2name) {
            a.createChild("button", {
                content: key2name[k],
                events: {
                    click: () => {
                        sv.toggle(key2name[k])
                    }
                }
            })
        }

        a.createChild("button", {
            content: "add side screen panel",
            events: {
                click: () => {
                    sv.addSideScreenPanel("more buttons", new Buttons())
                }
            }
        })
    }

    static get usedStyleSheets() {
        return ["./test.css"]
    }
}

class Main extends SvgPlus {
    constructor() {
        super("div")
        this.innerHTML = "LOADING";
        this.load();
    }

    async load() {
        await Promise.all([...([
            SessionView,
            MyClass,
            Buttons,
            AppsTest,
        ]).map(a=>a.loadStyleSheets()), ToolBarFeature.loadResources()])
        console.log("loaded");
        
        /** @type {SessionView} */
        let sv = this.createChild(SessionView);

        window.addEventListener("keydown", (e) => {
            if (e.key in key2name) sv.toggle(key2name[e.key]);
        })

        sv.setPanelContent("top", new MyClass())
        sv.setPanelContent("side", new MyClass(true))

        sv.addScreenArea("fullAspectArea", new Buttons(sv))
        sv.addSideScreenPanel("Apps", new AppsTest())

        this.toolBar = new ToolBarFeature(sv);
        let [toolBar, toolBarRing] = this.toolBar.getElements();
        sv.setPanelContent("tools", toolBar);
        sv.addScreenArea("fullAspectArea", toolBarRing);
    }
}


let main = new Main();
document.body.appendChild(main)


