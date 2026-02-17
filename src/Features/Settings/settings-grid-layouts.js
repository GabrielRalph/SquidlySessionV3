import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import * as Settings from "./settings-wrapper.js";

/**
 * @typedef {object} SettingsIconOptions
 * @property {string} name - The name of the icon
 * @property {string} [accessGroup] - The access group for the icon
 * @property {string} [setting] - The setting associated with the icon
 * @property {string} [settingKey] - The path to the setting associated with the icon
 * @property {boolean} [active] - Whether the icon is active or not
 * @property {boolean[]} [sideDots] - An array of booleans representing the state of side dots on the icon
 * @property {string[]} [path] - An array of strings representing the path to the setting associated with the icon
 * 
 * Also includes all properties of GridIconOptions:
 * @property {string} displayValue - The text to display below the icon.
 * @property {string} [subtitle] - The icon symbol, can be a string or an object with a url.
 * @property {IconSymbol} [symbol] - The icon symbol, see above.
 * @property {boolean} [hidden] - If true, the icon will be hidden.
 * @property {boolean} [disabled] - If true, the icon will be disabled and slightly see through.
 * @property {boolean} [displayOnly] - If true, the icon will not be interactive.
 */


class SettingsIconClickEvent extends AccessEvent {
    /**
     * Constructor for the SettingsIconClickEvent class, which is dispatched when a settings icon is clicked.
     * @param {Event} event - The original click event that triggered this settings click event
     * @param {SettingsIconOptions} icon - The options for the settings icon that was clicked
     * @param {SettingsIcon} element - The SettingsIcon element that was clicked
     */
    constructor(event, icon, element) {
        super("settings-click", event, {bubbles: true});
        this.icon = {...icon};
        this.iconElement = element;
    }
}



class SettingsIcon extends GridIcon {
    /**
     * Constructor for the SettingsIcon class, which represents an individual icon in the settings grid.
     * @param {SettingsIconOptions} icon - The options for the settings icon to create
     */
    constructor(icon, type) {
        if (typeof icon.accessGroup === "string") {
            type = icon.accessGroup;
        }
        super(icon, type);
        this.settingsKey = icon.settingKey || icon.setting;
        this.sideDotsElement = this.createChild("div", {class: "side-dots"})
        this.activeIcon = this.createChild(Icon, {class: "icon active"}, "radioTick");
        this.active = icon.active || false;

        if (Array.isArray(icon.path) && icon.setting) {
            this.setting = icon.path.join("/") + "/" + icon.setting
            this.setAttribute("setting", this.setting);
            this.updateDynamicTemplate();
        }

        this.events = {
            // When the icon is clicked, dispatch a SettingsIconClickEvent with the icon and element details
            "access-click": (e) => this.dispatchEvent(new SettingsIconClickEvent(e, icon, this))
        }

    }

    get settingName() {
        return (this.path || []).join("/") + "/" + this.settingsKey;
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

export class SettingsGridLayout extends GridLayout {

    /**
     * Constructor for the SettingsGridLayout class
     * @param {SettingsIconOptions[][]} grid - A 2D array of icon data objects to create the grid from
     */
    constructor(grid) {
        super(1, 1);
        this.grid = grid;
    }

    /**
     * @param {SettingsIconOptions[][]} grid - A 2D array of icon data objects to create the grid from
     */
    set grid(grid) {
        this.innerHTML = "";

        if (Array.isArray(grid)) {
            this.size = [
                grid.length, 
                Math.max(...grid.map(row => row.length))
            ];
    
            this.addItemInstances(SettingsIcon, grid, 0, 0);
        }

    }

}