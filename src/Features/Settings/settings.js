import { get, set } from "../../Firebase/firebase.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/access-buttons.js";
import { addDeviceChangeCallback, getDevices } from "../../Utilities/device-manager.js";
import { GridIcon } from "../../Utilities/grid-icon.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { Rotater } from "../../Utilities/rotater.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { changeDevice } from "../../Utilities/webcam.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import * as Settings from "./settings-base.js";

class SettingsIcon extends GridIcon {
    constructor(icon, type) {
        super(icon, type);
        this.sideDotsElement = this.createChild("div", {class: "side-dots"})
        this.activeIcon = this.createChild(Icon, {class: "icon active"}, "radioTick");
        this.active = icon.active || false;

        if (Array.isArray(icon.path) && icon.setting) {
            this.setting = icon.path.join("/") + "/" + icon.setting
            this.setAttribute("setting", this.setting);
            this.updateDynamicTemplate();
        }
    }


    set active(value) {
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
        this.grid = grid;
    }

    /**
     * @param {IconGrid[][]} grid
     */
    set grid(grid) {
        this.innerHTML = "";

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
                displayValue: "Exit",
                symbol: "close",
                action: "exit",
                
            }],
            [{
                type: "action",
                displayValue: "Home",
                symbol: "home",
                hidden: isHome,
                action: "home",
            }],
            [{
                type: "action",
                displayValue: "Back",
                symbol: "back",
                hidden: isHome,
                action: "back",  
            }],
        ]);
        this.path = [...path];

        grid.forEach(row => row.forEach(icon => {
            icon.path = path.slice(1);
        }));
        
        this.gridElement = this.createChild(IconGrid, {}, grid);
    }

     /**
     * @param {IconGrid[][]} grid
     */
    set grid(grid) { 
        grid.forEach(row => row.forEach(icon => {
            icon.path = this.path.slice(1);
        }));
        this.gridElement.grid = grid;
    }

}

const name2kind = {
    "video": "videoinput",
    "microphone": "audioinput",
    "speaker": "audiooutput",
}

function device2Icon(device) {
    const {active, label, deviceId} = device;
    return {
        type: "normal",
        displayValue: label,
        action: "change-device",
        device: deviceId,
        active: active,
    }
}

function devices2grid(devices) {
    let n = devices.length;
    n = n > 16 ? 16 : n;

    let gsize = n <= 9 ? 3 : 4;

    let grid = new Array(gsize).fill(0).map(() => new Array(gsize).fill(0).map(() => ({hidden: true})));
    
    for (let i = 0; i < gsize; i++) {   
        for (let j = 0; j < gsize; j++) {
            let index = i * gsize + j;
            if (index < n) {
                grid[i][j] = device2Icon(devices[index]);
            }
        }
    }
    
    return grid;
}

class SettingsWindow extends OccupiableWindow {
    history = [];

    /**@type {SettingsFeature} */
    settingsFeature = null;

    constructor(settings) {
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
        
        this.settingsFeature = settings;
        this.root.events = {
            "settings-click": (e) => e.waitFor(this.onSettingsClick(e)),
        };
        
        this.settingsPath = this.createChild("div", {class: "settings-path", content: "Settings"});
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
            let {icon} = e;
            let path = icon.path.join("/") + "/" + (icon.settingKey || icon.setting);
            Settings.toggleValue(path);
        },
        "change-device": (e) => {
            let {icon} = e;
            this.settingsFeature.changeDevice(icon.path[0], name2kind[icon.path[1]], icon.device);
        }
    }

    dynamicPages = {
        "video": () => this.makeDevices("videoinput"),
        "microphone": () => this.makeDevices("audioinput"),
        "speaker": () => this.makeDevices("audiooutput"),
    }

    async makeDevices(kind){
        let user = this.history[1];
        let devices = await this.settingsFeature.getDevices(user);
        devices = Object.values(devices[kind] || {});
        let grid = devices2grid(devices);
        return grid;
    }

    async onSettingsClick(e) {
       let {icon} = e;
       if (icon.action === "exit") return ;
       let res = await this.gotoLink(icon.link, e);
       if (!res) {
             if (icon?.action in this.actions) {
                await this.actions[icon.action](e);
            } else {
                const event = new AccessEvent("settings-click", e);
                event.icon = icon;
                event.iconElement = e.iconElement;
                this.dispatchEvent(event);
            }
        }
    }

    async gotoHome(e) {
        this.history = ["home"];
        await this.rotater.setContent(new SettingsPanel(this.settings.home, this.history), false);
        this.dispatchEvent(new AccessEvent("navigation", e));
    }

    async setPath(path) {
        let pathStr = path.join("/");
        let historyStr = this.history.join("/");
        this.settingsPath.textContent = path.join(" > ");
        
        if (historyStr !== pathStr) {
            this.history = [...path];
            let link = this.history.pop();
            await this.gotoLink(link);
        }
    }

    async gotoLink(link, e) {
        let grid = null;
        if (link in this.settings) {
            let value = this.settings[link];
            while (typeof value === "string" && value in this.settings) {
                value = this.settings[value];
            }
            grid = value;
        } else if (link in this.dynamicPages) {
            grid = await this.dynamicPages[link]();
        }
        
        if (grid !== null) {
            this.history.push(link);
            this.currentPage = new SettingsPanel(grid, this.history)
            await this.rotater.setContent(this.currentPage, false);
            this.dispatchEvent(new AccessEvent("navigation", e));
        }

        return grid !== null;
    }

    /**
     * @param {AccessEvent} e
     * @return {Promise<void>}
     */
    async gotoBack(e) {
        if (this.history.length > 1) {
            
            this.history.pop();
            let link = this.history.pop();
            await this.gotoLink(link);

            this.dispatchEvent(new AccessEvent("navigation", e));
        }
    }

    updateSettings() {
        let icons = this.root.querySelectorAll(".grid-icon[setting]");
        icons.forEach(icon => {
            icon.updateDynamicTemplate();
        })
    }

    updateDevices(user, devices) { 
        let [_, pathUser, settingType] = this.history

        if (pathUser === user && settingType in this.dynamicPages) {
            const kind = name2kind[settingType];
            devices = Object.values(devices[kind] || {});
            this.currentPage.grid = devices2grid(devices);
        }
    }

    set settings(settings) {
        this._settings = settings;
        this.gotoHome();
    }

    get settings() {
        return this._settings;
    }

    async open(){
        await this.root.show(400)
    }

    async close(){
        this.dispatchEvent(new Event("exit"));
        await this.root.hide(400)
    }

    static get usedStyleSheets() {
        return [relURL("./settings.css", import.meta), GridIcon.styleSheet, Rotater.styleSheet];
    }

    static get fixToolBarWhenOpen(){return true; }
}



export class SettingsFeature extends Features {
    constructor(session, sdata) {
        super(session, sdata);
        this.settingsWindow = new SettingsWindow(this);

        this.session.toolBar.addSelectionListener("settings", (e) => {
            e.waitFor(this.session.openWindow("settings"))  ;
        });

        this.settingsWindow.root.addEventListener("settings-click", (e) => { 
            if (e?.icon?.action === "exit") {
                this.sdata.set("path", null);
                e.waitFor(this.session.openWindow("default"));
            }
        })

        this.settingsWindow.events = {
            navigation: (e) => {
                let path = this.settingsWindow.history;
                sdata.set("path", path);
            },
            exit: () => {
                this.dispatchEvent(new Event("exit"));
            }
        }

        Settings.addChangeListener((name, value) => {
            this.settingsWindow.updateSettings();
            const event = new Event("change", {bubbles: true});
            event.path = name;
            let [user, type, setting] = name.split("/");
            event.user = user;
            event.group = type;
            event.setting = setting;
            event.value = value;    
            this.dispatchEvent(event);
        });
    }

    get(name) {
        return Settings.getValue(name);
    }

    setValue(name, value) {
        return Settings.setValue(name, value);
    }


    changeDevice(user, kind, deviceId) {
        if (user === this.sdata.me) {
            changeDevice(kind, deviceId);
        }  else {
            this.session.videoCall.sendData("change-device", [kind, deviceId]);
        } 
    }


    async getDevices(user) {
        let devices = {audioinput: {}, audiooutput: {}, videoinput: {}};
        if (user === this.sdata.me) {
            devices = await getDevices(true);
        } else {
            devices =  this.lastTheirDevices
        }
        
        return devices;
    }


    async initialise() {
        Settings.initialise(this.sdata);
        await SettingsWindow.loadStyleSheets();
        let settings = await (await fetch(relURL("./settings-layout.json", import.meta))).json();
        this.settingsWindow.settings = settings;

        addDeviceChangeCallback((devices) => {
            this.sdata.set("devices/"+this.sdata.me, devices);
            this.settingsWindow.updateDevices(this.sdata.me, devices);
        });
        this.sdata.set("devices/"+this.sdata.me, await getDevices(true));

        this.sdata.onValue("path", (path) => {
            if (path === null) {
                path = ["home"];
            }
            this.settingsWindow.setPath(path);
        });


        this.lastTheirDevices = {
            audioinput: {},
            audiooutput: {},
            videoinput: {},
        }
        this.sdata.onValue("devices/"+this.sdata.them, (devices) => {
            if (devices === null) {
                devices = {
                    audioinput: {},
                    audiooutput: {},
                    videoinput: {},
                }
            }
            this.lastTheirDevices = devices;
            this.settingsWindow.updateDevices(this.sdata.them, devices);
        });

        this.session.videoCall.addEventListener("change-device", (e) => {
            let [kind, deviceId] = e.data;
            this.changeDevice(this.sdata.me, kind, deviceId);
        });
    }

    static get firebaseName() {
        return "settings";
    }
}