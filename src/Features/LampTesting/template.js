import { SvgPlus } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";



class DummyWindow extends OccupiableWindow {
    constructor() {
        super("dummy-window");
        this.mainLayout = this.createChild(GridLayout, {}, 8, 1);
        this.text = new SvgPlus("div");
        this.text.styles = {
            "background": "white",
        }
        this.mainLayout.add(this.text, 0, 0);
        this.layout = this.mainLayout.add(new GridLayout(7, 12), 1, 0, 8, 0);
    }


    clear() {
        this.layout.innerHTML = "";
    }

    doAction(opts) {
        if (opts.message) {
            this.text.innerHTML += opts.message;
        }
    }

    addButton(opts, event) {
        let icon = this.layout.add(new GridIcon({
            type: "white",
            displayValue: opts.label,
            symbol: opts.icon_file ? "http://127.0.0.1:5500/" + opts.icon_file + ".png" : null,
            events: {
                "access-click": event
            }
        }), opts.position[1], opts.position[0]);
        let color = opts.style?.body_color || 0xFFFFFF;
        let fontSize = (opts.style?.font_height || 10) / 10;
        let r = (color >> 16) & 0xFF;
        let g = (color >> 8) & 0xFF;
        let b = color & 0xFF;

        icon.styles = {
            "--main": `rgb(${b}, ${g}, ${r})`,
            "--main-hover": `rgb(${Math.min(b + 30, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(r + 30, 255)})`,
            "font-size": `${fontSize* 0.5}em`,
        }
    }

    static get fixToolBarWhenOpen() {return true}

    static get usedStyleSheets() {
        return [
            GridIcon.styleSheet,
            relURL("./styles.css", import.meta)
        ]
    }
}
let LampPages = [];
export default class Lamp extends Features {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     * @param {import("../features-interface.js").SessionDataFrame} sdata
     */
    constructor(session, sdata){
        super(session, sdata)
        this.window = new DummyWindow();
    }

    openPage(pageNumber) {
        this.window.clear();
        let page = LampPages[pageNumber];
        for (let button of page.buttons) {
            this.window.addButton(button, button.linked_page ? () => {
                this.type = button.actions.indexOf("C8") !== -1;
                this.openPage(button.linked_page)
             } : () => {
                if (!this.type || button.actions.indexOf("C6") !== -1) {
                    this.openPage(1)
                }
                this.window.doAction(button);
            });
        }
    }

    async initialise() {
        this.session.toolBar.addMenuItem("access", {
            name: "lamp",
            symbol: "aac",
            onSelect: (e) => {
                console.log("Opening lamp testing window");
                e.waitFor(this.session.openWindow("lamp"))
            }
        })

        this.openPage(1)
        
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static async loadResources() {
        LampPages = await (await fetch(relURL("./pages_with_icons.json", import.meta))).json();

        //load any resources required for this feature
        DummyWindow.loadStyleSheets();
    }

    /* Must have name static getter 
       for feature to be recognised 
    */
    // static get name() {
    //     return "lamp"
    // }

    static get layers() {
        return {
            window: {
                type: "area",
                area: "fullAspectArea",
                index: 230,
            }
        }
    }

    static get firebaseName(){
        return "some-name";
    }
}