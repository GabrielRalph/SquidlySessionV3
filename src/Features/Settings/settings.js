import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { addDeviceChangeCallback, getDevices } from "../../Utilities/device-manager.js";
import { GridIcon } from "../../Utilities/Buttons/grid-icon.js";
import { Rotater } from "../../Utilities/rotater.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { changeDevice } from "../../Utilities/webcam.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { SettingsDescriptor } from "./settings-base.js";
import * as Settings from "./settings-wrapper.js";
import { SettingsGridLayout } from "./settings-grid-layouts.js";

/**
 * @typedef {import("./settings-grid-layouts.js").SettingsIconOptions} SettingsIconOptions
 */

class InteractionEvent extends AccessEvent {
    constructor(e, icon) {
        super("interaction", e, {cancelable: true});
        this.icon = icon;
    }
}

class ProfileSearchWindow extends SearchWindow {
    constructor(){
        super();
    }

    async getSearchResults(searchPhrase){
        let profiles = Settings.getProfiles();

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

/**
 * The settings panel shows a grid of icons for a specific settings page as 
 * well as a navigation icons to navigate between settings pages. It is used
 * inside the settings window.
 * 
 * @fires AccessEvent#settings-click when a settings icon is clicked, with the icon data in event.icon
 * @property {SettingsIconOptions[][]} grid - The 2D array of GridIcons representing the settings options
 */
class SettingsPanel extends SvgPlus {
    constructor(grid, path, settingsFeature = null) {
        super("settings-panel");
        let isHost = settingsFeature ? settingsFeature.sdata.me === "host" : false;
        let isHome = path.length === 1;
       
        // Create the settings navigation icons
        this.createChild(SettingsGridLayout, {}, [
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
        this._gridElement = this.createChild(SettingsGridLayout);
        this.grid = grid;
    }

     /**
     * @param {IconGrid[][]} grid
     */
    set grid(grid) { 
        grid.forEach(row => row.forEach(icon => {
            icon.path = this.path.slice(1);
        }));
        this._gridElement.grid = grid;
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
            "settings-click": (e) => e.waitFor(this._onSettingsClick(e)),
        };
        
        this.settingsPath = this.createChild("div", {class: "settings-path", content: "Settings"});

        this.rotater = this.createChild(Rotater);

        // Create profile search window if host
        if (this.settingsFeature.sdata.me === "host") {
            this.searchWindow = this.createChild(ProfileSearchWindow, {events: {
                "value": (e) => {
                    if (e.value) {
                        settings.chooseProfile(e.value.id);
                    }
                    e.waitFor(this.searchWindow.hide());
                }
            }});
        }
    }

    /**
     * Gets the grid layout for a specific settings page. 
     * @param {string} page - The name of the settings page to get the grid layout for
     * @returns {SettingsIconOptions[][]} The grid layout for the settings page, or null if no layout is found
     */
    _getSettingsPageLayout(page) {
        let grid = null;
        if (page in this.settingsLayout) {
            // Find the grid layout for the page, resolving any references to other settings
            let value = this.settingsLayout[page];
            while (typeof value === "string" && value in this.settingsLayout) {
                value = this.settingsLayout[value];
            }
            grid = value;
        }
        return grid;
    }

    /**
     * This method is called when a settings icon is clicked. 
     * @param {AccessEvent} e - The event object containing information about the click event
     */
    async _onSettingsClick(e) {
       let {icon} = e;

       const newEvent = new InteractionEvent(e, icon);
       this.dispatchEvent(newEvent);

        if (newEvent.defaultPrevented === false) {
           let lastPath = this.history.join("/");

            // Check if the icon has a link to another page, if so navigate to that page
            if (icon.link in this._dynamicPages || this._getSettingsPageLayout(icon.link) !== null) {
                await this.gotoPath([...this.history, icon.link], e);
            
            // Otherwise, if the icon has an action, perform that action
            } else if (icon?.action in this._actions) {
                const settingPath = (icon.path || []).join("/") + "/" + (icon.setting || icon.settingKey);
                await this._actions[icon.action](e, settingPath);
            }

            // After handling the click, check if the path has changed and log it if it has
            let newPath = this.history.join("/");
            if (lastPath !== newPath) {
                this.dispatchEvent(new Event("path-change"));
            }
        }
    }

    /**
     * Actions details a list of action methods that may be executed when settings icons are clicked. 
     * The action to execute is determined by the "action" property of the clicked icon. 
     */
    _actions = {
        home: e => e.waitFor(this.gotoPath(["home"], e)),
        back: e => e.waitFor(this.gotoPath(this.history.slice(0, -1), e)),
        search: e => e.waitFor(this.openProfileSearch()),
        "increment-setting": (e, name) => {
            let {icon: {direction}} = e;
            this.settingsFeature.incrementValue(name, direction);
        },
        "set-setting": (e, name) => {
            let {icon: {value}} = e;
            this.settingsFeature.setValue(name, value);
        },
        "toggle-setting": (e, name) => {
            this.settingsFeature.toggleValue(name);
        },
        "change-device": (e) => {
            let {icon} = e;
            let kind = name2kind[icon.path[icon.path.length - 1]];
            this.settingsFeature.changeDevice(icon.path[0], kind, icon.device);
        }
    }


    /**
     * Generates the grid layout for the devices settings page for a specific device type (video, microphone, speaker).
     * @param {("video"|"microphone"|"speaker")} kind - The type of device to generate the grid for ("video", "microphone", or "speaker")
     * @returns {SettingsIconOptions[][]} The grid layout for the devices settings page for the specified device type
     */
    async _makeDevicesSettingGrid(kind){
        let user = this.history[1];
        let devices = await this.settingsFeature.getDevices(user);
        devices = Object.values(devices[kind] || {});
        let grid = devices2grid(devices);
        return grid;
    }

    /**
     * @type {Object.<string, async () => SettingsIconOptions[][]>} _dynamicPages - An object mapping page names to functions that generate the grid layout for those pages.
     */
    _dynamicPages = {
        "video": () => this._makeDevicesSettingGrid("videoinput"),
        "microphone": () => this._makeDevicesSettingGrid("audioinput"),
        "speaker": () => this._makeDevicesSettingGrid("audiooutput"),
    }


    /**
     * Goes to a specific path in the settings, navigating to the corresponding page.
     * @param {string[]} path - An array of strings representing the path to navigate to in the settings
     * @param {AccessEvent} [event] - The event initiating the navigation.
     */
    async gotoPath(path, event) {
        // Provided the path is different from the current path
        if (this.currentPath !== path.join("/")) {

            // Get the last part of the path to find the grid layout for the page
            let pageName = path[path.length - 1];

            let grid = null;
            
            // If the page is a dynamic page, generate the grid for the page
            if (pageName in this._dynamicPages) {
                grid = await this._dynamicPages[pageName]();

            // Otherwise, get the grid layout for the page from the settings layout
            } else {
                grid = this._getSettingsPageLayout(pageName);
            }

            // If a grid was found for the page, navigate to the page
            if (grid !== null) {
                this.history = [...path];
                this.currentPage = new SettingsPanel(grid, this.history, this.settingsFeature);
                this.settingsPath.innerHTML = this.history.join(" > ");

                // If the event is passed as null then the transition will be instant
                await this.rotater.setContent(this.currentPage, event === false);
            }
        }
    }

   
    /**
     * Updates the device grids in the settings window for a specific user when their devices change. 
     */
    updateDevices(user, devices) { 
        if (this.history.length > 1) {
            let pathUser = this.history[1];
            let settingType = this.history[this.history.length - 1];
            if (pathUser === user && settingType in this._dynamicPages) {
                const kind = name2kind[settingType];
                devices = Object.values(devices[kind] || {});
                this.currentPage.grid = devices2grid(devices);
            }
        }
    }


    /**
     * Updates the settings icons on the current page, for example after a setting value has changed. 
     */
    updateSettings() {
        let icons = this.root.querySelectorAll(".grid-icon[setting]");
        icons.forEach(icon => {
            icon.updateDynamicTemplate();
        })
    }
    

    /**
     * Opens the profile search window, allowing the user to search for and select a profile.
     */
    async openProfileSearch() {
        await this.searchWindow.resetSearchItems(true);
        await this.searchWindow.show();
    }

    get currentPath() {
        return this.history.join("/");
    }
   
    set settingsLayout(settings) {
        this._settings = settings;
    }

    get settingsLayout() {
        return this._settings;
    }

    async open(){
        await this.show(400)
    }

    async close(){
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

        // Add toolbar icon
        this.session.toolBar.addMenuItem([], {
            name: "settings",
            index: 35,
            onSelect: async e => e.waitFor(this._openSettingsAtHome()),
        })
 

        // Listen to settings icon clicks in the settings window and handle navigation and actions
        this.settingsWindow.events = {
            interaction: async (e) => {
                if (e.icon?.action === "exit") {
                    e.preventDefault();
                    await e.waitFor(this.session.openWindow("default"));
                } else if (e.icon?.action === "back" && this._openPageOnBack) {
                    e.preventDefault();
                    await e.waitFor(session.openWindow(this._openPageOnBack));
                }
                this._openPageOnBack = null;
                this.sdata.set("openPageOnBack", null); 
            },
            "path-change": () => {
                this.sdata.set("path", this.settingsWindow.history);
            }
        }

        // Listen to changes in settings values and update the settings window accordingly
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

    incrementValue(name, direction) {
        this._applySettingsUpdate("incrementValue", name, direction);
    }

    setValue(name, value) {
        this._applySettingsUpdate("setValue", name, value);
    }

    toggleValue(name) {
        this._applySettingsUpdate("toggleValue", name);
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

    async gotoPath(path, event) {
        if (typeof path === "string") {
            path = path.split("/");
        }
        let valid = this.isValidPath(path);
        if (valid) {
            let prom = this.settingsWindow.gotoPath(path, event);
            this.sdata.set("path", path);
            await prom;
        } else {
            console.warn("Invalid settings path:", path.join("/"));
        }
    }

    chooseProfile(profileID) {
        if (this.sdata.me === "host") {
            this.sdata.set("profileID", profileID);
            this.sdata.logChange("settings.profile", {value: profileID});
        }
    }

    async createProfile(name) {
        let id = null;
        if (this.sdata.me === "host") {
            id = await Settings.createProfile(this.sdata.hostUID, name);
        }
        return id;
    }

    /**
     * Sets a page to open when the user tries to go back from the current page. 
     * This is used if features want to open settings but allow users to easily 
     * go back to the feature that sent them to settings.
     * @param {string} page - The page to open when the user goes back.
     */
    openPageOnBack(page) {
        this.sdata.set("openPageOnBack", page);
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

    async _openSettingsAtHome() {
        await this.sdata.set("path", ["home"]);
        await this.session.openWindow("settings");
    }
    
    _applySettingsUpdate(method, path, ...args) {
        if (method in Settings) {
            let oldValue = Settings.getValue(path);
            Settings[method](path, ...args);
            let value = Settings.getValue(path);
            if (oldValue !== value) {
                let ops = {note: path, value, oldValue};
                this.sdata.logChange("settings.value", ops);
            }
        }
    }

    async initialise() {
        let hostUID = this.sdata.hostUID;
        await Settings.initialise(hostUID),

        
        this.settingsWindow.settingsLayout = SettingsFeature.SettingsLayout;

        // Whatch profiles if host.
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

            this.settingsWindow.gotoPath(path, this.session.currentOpenFeature == SettingsFeature.name);
            this._openPath = path;
        });

        this.sdata.onValue("openPageOnBack", (page) => {
            this._openPageOnBack = page;
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

    static async loadLayout() {
        this.SettingsLayout = await (await fetch(relURL("./settings-layout.json", import.meta))).json();
    }

    static async loadResources() {
        await Promise.all([
            await SettingsWindow.loadStyleSheets(),
            this.loadLayout(),
        ]);
    }

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