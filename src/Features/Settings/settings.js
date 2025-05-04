import { get, set } from "../../Firebase/firebase.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/access-buttons.js";
import { GridIcon } from "../../Utilities/grid-icon.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { Rotater } from "../../Utilities/rotater.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { getTrackSelection } from "../../Utilities/webcam.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import * as Settings from "./settings-base.js";


class SettingsIcon extends GridIcon {
    constructor(icon, type) {
        super(icon, type);
        this.sideDotsElement = this.createChild("div", {class: "side-dots"})
        this.activeIcon = this.createChild(Icon, {class: "active"}, "radioTick");

        if (Array.isArray(icon.path) && icon.setting) {
            
            this.setting = icon.path.join("/") + "/" + icon.setting
            console.log(this.setting);
            this.setAttribute("setting", this.setting);
            this.updateDynamicTemplate();
        }

    }

    set active(value) {
        console.log(value);
        
        this.activeIcon.toggleAttribute("show", value);
    }

    updateDynamicTemplate(){
        let icon = Settings.getIcon(this.setting);
        
        for (let key in icon) {
            this[key] = icon[key];
        }
    }


    /** @param {boolean[]} value */
    set sideDots(value) {
        if (this.sideDotsElement){
            this.sideDotsElement.innerHTML = "";
            for (let bool of value) {
                this.sideDotsElement.createChild("div", {
                    class: "dot",
                }).toggleAttribute("on", bool);
            }
        }        
    }
}

class IconGrid extends SvgPlus{
    /**
     * @param {IconGrid[][]} grid
     */
    constructor(grid) {
        super("icon-grid");

        let rows = grid.length;
        let cols = Math.max(...grid.map(row => row.length));

        this.styles = {
            "display": "grid",
            "grid-template-columns": `repeat(calc((100% - ${cols-1} * var(--gap)) / ${cols}), 1fr)`,
            "grid-template-rows": `repeat(calc((100% - ${rows-1} * var(--gap)) / ${rows}), 1fr)`,
            "gap": "var(--gap)",    
        }

        grid.forEach((row, i) => {
            row.forEach((icon, j) => {
                let iconElement = new SettingsIcon(icon, "settings-" + i);
                iconElement.styles = {
                    "grid-row": `${i+1}`,
                    "grid-column": `${j+1}`,
                }
                iconElement.events = {
                    "access-click": (e) => {
                        let event = new AccessEvent("settings-click", e, {bubbles: true});
                        event.icon = icon;
                        event.iconElement = iconElement;
                        this.dispatchEvent(event);
                    }
                }
                this.appendChild(iconElement);
            });
        });
        
    }

    
}

class SettingsPanel extends SvgPlus {
    constructor(grid, path) {
        super("settings-panel");
        let isHome = path.length === 1;
        this.createChild(IconGrid, {}, [
            [{
                type: "action",
                displayValue: "exit",
                symbol: "close",
                action: "exit",
                
            }],
            [{
                type: "action",
                displayValue: "home",
                symbol: "home",
                hidden: isHome,
                action: "home",
            }],
            [{
                type: "action",
                displayValue: "back",
                symbol: "back",
                hidden: isHome,
                action: "back",  
            }],
        ]);
        grid.forEach(row => row.forEach(icon => {
            icon.path = path.slice(1);
        }));
        
        this.createChild(IconGrid, {}, grid);
    }
}

class SettingsWindow extends OccupiableWindow {
    history = [];
    constructor() {
        let root = new HideShow("settings-window");
        root.applyIntermediateState = () => {
            root.styles = {
                "display": null,
            }
        }
        root.applyShownState = () => {
            root.styles = {
                "display": null,
                "pointer-events": "all",
            }
        }
        root.applyHiddenState = () => {
            root.styles = {
                "display": "none",
            }
        }
        root.shown = false
        super("settings-window", root);
        
        this.root.events = {
            "settings-click": this.onSettingsClick.bind(this),
        };


        this.rotater = this.createChild(Rotater);
    }

    actions = {
        home: this.gotoHome.bind(this),
        back: this.gotoBack.bind(this),
        "increment-setting": (e) => {
            let {icon} = e;
            let path = icon.path.join("/") + "/" + (icon.settingKey || icon.setting);
            let direction = icon.direction;
            Settings.incrementValue(path, direction);
        },
        "set-setting": (e) => {
            let {icon} = e;
            let path = icon.path.join("/") + "/" + (icon.settingKey || icon.setting);
            let value = icon.value;
            Settings.setValue(path, value);
        },
        "toggle-setting": (e) => {
            console.log(e);
            
            let {icon} = e;
            let path = icon.path.join("/") + "/" + (icon.settingKey || icon.setting);
            
            Settings.toggleValue(path);
        }
    }
    dynamicPages = {
        "video": () => this.make_devices("videoinput"),
        "microphone": () => this.make_devices("audioinput"),
        "speaker": () => this.make_devices("audiooutput"),
        "access": () => this.make_sliders([
            ["longer dwell", "shorter dwell"],
            ["longer switch", "shorter switch"],
            ["next voice", "last voice"],
        ]),
    }

    async make_devices(type){
        let devices = await getTrackSelection(type);
        let n = devices.length;
        n = n > 16 ? 16 : n;

        
        let gsize = n <= 9 ? 3 : 4;

        let grid = new Array(gsize).fill(0).map(() => new Array(gsize).fill(0).map(() => ({hidden: true})));
        
        for (let i = 0; i < gsize; i++) {   
            for (let j = 0; j < gsize; j++) {
                let index = i * gsize + j;
                if (index < n) {
                    grid[i][j] = {
                        type: "normal",
                        displayValue: devices[index].label,
                        // symbol: devices[index].label,
                        action: "device",
                        device: devices[index],
                        active: devices[index].active,
                    }
                }
            }
        }

        return grid;
    }

    make_sliders(names){
        let up = [];
        let values = [];
        let down = [];
        for (let [nameUp, nameDown] of names) {
            up.push({
                type: "adjective",
                displayValue: nameUp,
                symbol: "upArrow",
                action: "slider-up",
            });
            down.push({
                type: "adjective",
                displayValue: nameDown,
                symbol: "downArrow",
                action: "slider-down",
            });
            values.push({
                type: "normal",
                displayValue: 0,
                symbol: "",
            });
        }

        return [
            up,
            values,
            down,
        ]
    }

    async onSettingsClick(e) {
       let {icon} = e;
       if (await this.gotoLink(icon.link)) {
        
       } else if (icon?.action in this.actions) {
            this.actions[icon.action](e);
       } else {
            const event = new AccessEvent("settings-click", e);
            event.icon = icon;
            event.iconElement = e.iconElement;
            this.dispatchEvent(event);
       }
    }

    gotoHome() {
        this.history = ["home"];
        this.rotater.setContent(new SettingsPanel(this.settings.home, this.history), false);
    }

    async gotoLink(link) {
        let grid = null;
        if (link in this.settings) {
            grid = this.settings[link];
        } else if (link in this.dynamicPages) {
            grid = await this.dynamicPages[link]();
        }
        
        if (grid !== null) {
            this.history.push(link);
            await this.rotater.setContent(new SettingsPanel(grid, this.history), false);
        }
        return grid !== null;
    }

    async gotoBack() {
        
        if (this.history.length > 1) {
            this.history.pop();
            let link = this.history.pop();
            await this.gotoLink(link);
        }
    }

    updateSettings() {
        let icons = this.root.querySelectorAll(".grid-icon[setting]");
        icons.forEach(icon => {
            icon.updateDynamicTemplate();
        })
    }

    set settings(settings) {
        this._settings = settings;
        this.gotoHome();
    }

    get settings() {
        return this._settings;
    }

    open(){
        this.root.show(400)
    }

    close(){
        this.root.hide(400)
    }

    static get usedStyleSheets() {
        return [relURL("./settings.css", import.meta), GridIcon.styleSheet, Rotater.styleSheet];
    }

    static get fixToolBarWhenOpen(){return true; }
}



export class SettingsFeature extends Features {
    constructor(session, sdata) {
        super(session, sdata);
        this.settingsWindow = new SettingsWindow();

        this.session.toolBar.addSelectionListener("settings", (e) => {
            e.waitFor(this.session.openWindow("settings"))  ;
        });

        this.settingsWindow.addEventListener("settings-click", (e) => { 
            
            if (e?.icon?.action === "exit") {
                this.session.openWindow("default");
            } else if (e?.icon?.action in this.settingActions) {
                this.settingActions[e.icon.action](e);
            }
        })

        Settings.addChangeListener((name, value) => {
            
            this.settingsWindow.updateSettings();
        });
    }

    settingActions = {
        "increment-setting": (e) => {
            
        }
    }


    
   

    async initialise() {
        await SettingsWindow.loadStyleSheets();
        let settings = await (await fetch(relURL("./settings.json", import.meta))).json();
        this.settingsWindow.settings = settings;
    }
}