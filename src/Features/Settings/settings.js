import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { addDeviceChangeCallback, getDevices } from "../../Utilities/device-manager.js";
import { GridIcon } from "../../Utilities/Buttons/grid-icon.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { Rotater } from "../../Utilities/rotater.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { changeDevice } from "../../Utilities/webcam.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";

import { Features, OccupiableWindow } from "../features-interface.js";

import { SettingsDescriptor } from "./settings-base.js";
import * as Settings from "./settings-wrapper.js";


class ProfileSearchWindow extends SearchWindow {
    constructor(){
        super();
    }

    async getSearchResults(searchPhrase){
        let profiles = Settings.getProfiles();

        console.log("SEARCHING PROFILES", profiles);

        /** @type {Answer[]} */
        let items = profiles.map(({name, image, profileID}) => {
            return {
                id: profileID,
                icon: {
                    displayValue: name,
                    symbol: image,
                    type: "normal"
                },
            }
        })
        items.push({
            id: null,
            icon: {
                displayValue: "Default Profile",
                type: "noun",
                symbol: "user"
            },
        })
        items = filterAndSort(items, searchPhrase, ({icon: {displayValue}}) => [displayValue]);
        return items;
    }
}

class SettingsIcon extends GridIcon {
    constructor(icon, type) {
        if (typeof icon.accessGroup === "string") {
            type = icon.accessGroup;
        }
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
    constructor(grid, path, settingsFeature = null) {
        super("settings-panel");
        let isHost = settingsFeature ? settingsFeature.sdata.me === "host" : false;
        let isHome = path.length === 1;
        this.createChild(IconGrid, {}, [
            [{
                type: "action",
                displayValue: "Exit",
                symbol: "close",
                action: "exit",
                accessGroup: "settings-navigation"
                
            }],
            [{
                type: "action",
                displayValue: "Home",
                symbol: "home",
                hidden: isHome,
                action: "home",
                accessGroup: "settings-navigation"
            }],
            isHome && isHost ? [{
                type: "action",
                displayValue: "Profiles",
                symbol: "search",
                action: "search",  
                accessGroup: "settings-navigation"
            }] : [{
                type: "action",
                displayValue: "Back",
                symbol: "back",
                hidden: isHome,
                action: "back",  
                accessGroup: "settings-navigation"
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
        super("settings-window");
        
        this.settingsFeature = settings;
        this.root.events = {
            "settings-click": (e) => e.waitFor(this.onSettingsClick(e)),
        };
        
        this.settingsPath = this.createChild("div", {class: "settings-path", content: "Settings"});
        this.rotater = this.createChild(Rotater);

        if (this.settingsFeature.sdata.me === "host") {
            this.searchWindow = this.createChild(ProfileSearchWindow, {events: {
                "value": (e) => {
                    if (e.value) {
                        settings._selectProfile(e.value.id);
                    }
                    e.waitFor(this.searchWindow.hide());
                }
            }});
        }
    }

    actions = {
        home: this.gotoHome.bind(this),
        back: this.gotoBack.bind(this),
        search: this.openProfileSearch.bind(this),
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
            let kind = name2kind[icon.path[icon.path.length - 1]];
            this.settingsFeature.changeDevice(icon.path[0], kind, icon.device);
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
        await this.rotater.setContent(new SettingsPanel(this.settings.home, this.history, this.settingsFeature), false);
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
            this.currentPage = new SettingsPanel(grid, this.history, this.settingsFeature);
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
        let pathUser = this.history[1];
        let settingType = this.history[this.history.length - 1];
        if (pathUser === user && settingType in this.dynamicPages) {
            const kind = name2kind[settingType];
            devices = Object.values(devices[kind] || {});
            this.currentPage.grid = devices2grid(devices);
        }
    }

    async openProfileSearch() {
        await this.searchWindow.resetSearchItems(true);
        await this.searchWindow.show();
    }

    set settings(settings) {
        this._settings = settings;
        this.gotoHome();
    }

    get settings() {
        return this._settings;
    }

    async open(){
        await this.show(400)
    }

    async close(){
        this.dispatchEvent(new Event("exit"));
        await this.hide(400)
    }

    static get usedStyleSheets() {
        return [relURL("./settings.css", import.meta), GridIcon.styleSheet, Rotater.styleSheet, SearchWindow.styleSheet];
    }

    static get fixToolBarWhenOpen(){return true; }
}

export default class SettingsFeature extends Features {
    constructor(session, sdata) {
        super(session, sdata);
        this.settingsWindow = new SettingsWindow(this);

        this.session.toolBar.addMenuItem([], {
            name: "settings",
            index: 35,
            onSelect: e => e.waitFor(this.session.openWindow("settings"))
        })
     
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

    

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    get settingsPathClientHeight() {
        return this.settingsWindow.settingsPath.clientHeight;
    }

    isValidPath(path) {
        let valid = false;
        if (Array.isArray(path) && path.length > 0) {
            let root = path[0];
            if (root === "home") {
                let settingsObject = Settings.getSettingsAsObject();
                for (let i = 1; i < path.length; i++) {
                    settingsObject = settingsObject[path[i]];
                    if (settingsObject === undefined) {
                        break;
                    }
                }
                valid = settingsObject !== undefined && !(settingsObject instanceof SettingsDescriptor);
            }
        } 
        return valid;
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

    async gotoPath(path) {
        if (typeof path === "string") {
            path = path.split("/");
        }

        let valid = this.isValidPath(path);
        if (valid) {
            this.sdata.set("path", path);
            await this.settingsWindow.setPath(path);
        } else {
            console.warn("Invalid settings path:", path.join("/"));
        }
    }

    chooseProfile(profileID) {
        if (this.sdata.me === "host") {
            this.sdata.set("profileID", profileID);
        }
    }

    async createProfile(name) {
        let id = null;
        if (this.sdata.me === "host") {
            id = await Settings.createProfile(this.sdata.hostUID, name);
        }
        return id;
    }

    get profiles() {
        let profiles = Settings.getProfiles();
        return profiles;
    }
    
    get openPath() {
        return this._openPath.join("/");
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    _selectProfile(profileID) {
        this.sdata.set("profileID", profileID);
    }

    async initialise() {
        let hostUID = this.sdata.hostUID;
        Settings.initialise(hostUID);
        await SettingsWindow.loadStyleSheets();
        let settingsLayout = await (await fetch(relURL("./settings-layout.json", import.meta))).json();
        this.settingsWindow.settings = settingsLayout;

        if (this.sdata.me === "host") {
            Settings.watchProfiles(hostUID, (profiles) => {
                this.dispatchEvent( new Event("profiles-change"))
            });
        }

        // Listen to path changes
        this.sdata.onValue("path", (path) => {
            if (path === null) {
                path = ["home"];
            }
            this.settingsWindow.setPath(path);
            this._openPath = path;
        });

        // Listen to profile changes
        this.sdata.onValue("profileID", (profileID) => {
            Settings.chooseProfile(profileID);
        });


        // When devices change locally, update them in firebase
        // and in the settings window
        addDeviceChangeCallback((devices) => {
            this.sdata.set("devices/"+this.sdata.me, devices);
            this.settingsWindow.updateDevices(this.sdata.me, devices);
        });


        // Set the current devices initially in firebase
        this.sdata.set("devices/"+this.sdata.me, await getDevices(true));

        this.lastTheirDevices = {
            audioinput: {},
            audiooutput: {},
            videoinput: {},
        }
        // Listen to the other users device changes in the firebase
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

        // Listen to device change requests from the video call
        this.session.videoCall.addEventListener("change-device", (e) => {
            let [kind, deviceId] = e.data;
            this.changeDevice(this.sdata.me, kind, deviceId);
        });
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get layers() {
        return {
            settingsWindow: {
                type: "area",
                area: "fullAspectArea",
                index: 81,
                mode: "occupy",
            }
        }
    }

    static get name() {
        return "settings";
    }

    static get firebaseName() {
        return "settings";
    }
}