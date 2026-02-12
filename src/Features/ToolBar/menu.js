function notString(value) {
    return typeof value !== "string" || value.trim() === "";
}

class EventTreeNode {
    constructor(parent) {
        this._parent = parent;
        this._eventHandlers = {};
    }

    _callEvent(name, ...args) {
        if (this.onUpdate instanceof Function) {
            let fname = "on" + name[0].toUpperCase() + name.slice(1)
            if (this[fname] instanceof Function) {
                this[fname](...args);
            }
            for (let handler of this._eventHandlers[name] || []) {
                handler(...args);
            }
        }
        if (this._parent) {
            this._parent._callEvent(name, ...args);
        }
    }

    addEventListener(name, cb) {
         if (cb instanceof Function) {
            if (!(name in this._eventHandlers)) {
                this._eventHandlers[name] = new Set();
            }
            this._eventHandlers[name].add(cb)
        }
    }
    
    removeEventListener(name, cb) {
        if (cb instanceof Function && name in this._eventHandlers) {
            this._eventHandlers[name].delete(cb);
        }
    }

}



/**
 * @typedef {Object} MenuItemOptions
 * @property {string} name
 * @property {import("../../Utilities/Icons/icons-library.js").IconName} symbol
 * @property {string} text
 * @property {string} color
 * @property {string} notification
 * @property {string} notificationColor
 * @property {string} notifcationTextColor
 * @property {boolean} hidden
 * @property {MenuItemOptions[]} subMenu
 */

export class MenuItem extends EventTreeNode {
    constructor(options, menu) {
        if (typeof options !== "object" || options === null) {
            throw new Error("MenuItem options must be an object");
        }
        super(menu);
        this._menu = menu;
        for (let prop of MenuItem.iconProperties) {
            this[prop] = options[prop];
        }

        this._callUpdate = menu._callUpdate.bind(menu);
    }

    _callUpdate() {
        this._callEvent("update", this);
    }

    remove() {
        if (this._menu) {
            this._menu._removeItem(this);
        }
    }

    getItem(path) {
        let res = null;

        if (typeof path === "string") {
            path = path.split("/");
        }

        if (Array.isArray(path)) {
            if (path.length === 0) {
                res = this;
            } else if (this.subMenu) {
                res = this.subMenu.getItem(path);
            }
        }

        return res;
    }

    set index(value) {
        this._index = Number.isFinite(value) ? value : Infinity;
        this._callUpdate();
    }
    get index() { return this._index; }

    set onSelect(value) {
        if (!(value instanceof Function)) {
            value = () => {};
        }
        this._onSelect = value;
    }
    get onSelect() { return this._onSelect; }


    set name(value) {
        if (notString(value)) {
            throw new Error("MenuItem 'name' must be a non-empty string");
        }
        this._name = value;
        this._callUpdate();
    }

    get name() { return this._name; }

    set symbol(value) {
        if (notString(value)) {
            value = this.name;
        }
        this._symbol = value;
        this._callUpdate();
    }
    get symbol() { return this._symbol; }

    set text(value) {
        if (notString(value)) {
            value = this.name;
        }
        this._text = value;
        this._callUpdate();
    }
    get text() { return this._text; }

    set hidden(value) {
        this._hidden = Boolean(value);
        this._callUpdate();
    }
    get hidden() { return this._hidden; }

    set color(value) {
        this._color = value;
        this._callUpdate();
    }
    get color() { return this._color; }

    set notification(value) {
        this._notification = value;
        this._callUpdate();
    }
    get notification() { return this._notification; }

    set notificationColor(value) {
        this._notificationColor = value;
        this._callUpdate();
    }
    get notificationColor() { return this._notificationColor; }

    set notificationTextColor(value) {
        this._notificationTextColor = value;
        this._callUpdate();
    }
    get notificationTextColor() { return this._notificationTextColor; }

    set subMenu(value) {
        if (!Array.isArray(value)) {
            value = null;
        }
        this._callUpdate();
        this._subMenu = value ? new Menu(value, this) : null;
    }
    get subMenu() { return this._subMenu; }


    get isSubMenu() {
        return this._subMenu instanceof Menu && this._subMenu.items.length > 0;
    }

    static get iconProperties() {
        return [
            "index",
            "name",
            "symbol",
            "text",
            "hidden",
            "color",
            "notification",
            "notificationColor",
            "notificationTextColor",
            "subMenu",
            "onSelect",
        ]
    }
}

export class Menu extends EventTreeNode {
    constructor(items, parent) {
        super(parent);
        this._itemsByKey = {};
        this._itemsList = [];
        this.addItems(items || []);

    }

    _callUpdate() {
        this._callEvent("update", this);
    }

    _addItem(options) {
        const item = new MenuItem(options, this);
        this._itemsList.push(item);
        this._itemsByKey[item.name] = item;
        this._callUpdate();
    }

    _removeItem(item) {
        const index = this._itemsList.indexOf(item);
        if (index !== -1) {
            this._itemsList.splice(index, 1);
            delete this._itemsByKey[item.key];
            this._callUpdate();
        }
    }
    
    /**
     * Adds a menu item to the menu.
     * @param {MenuItemOptions} options - The options for the menu item.
     */
    addItem(options) {
        this._addItem(options);
        this._itemsList.sort((a, b) => a.index - b.index);
        this._callUpdate();
    }

    /**
     * Adds multiple menu items to the menu.
     * @param {MenuItemOptions[]} optionsArray - An array of menu item options.
     */
    addItems(optionsArray) {
        optionsArray.map(
            (options, i) => this._addItem(options)
        );
        this._itemsList.sort((a, b) => a.index - b.index);
        this._callUpdate();
    }

    /**
     * Gets a menu item by its path.
     * @param {string|string[]} path - The path to the menu item, either as a string (with '/' separators) or an array of strings.
     * @returns {MenuItem|null} The menu item at the specified path, or null if not found.
     */
    getItem(path) {
        let res = null;

        if (typeof path === "string") {
            path = path.split("/");
        }

        if (Array.isArray(path)) {
            if (path.length === 0) {
                res = this;
            } else if (path[0] in this._itemsByKey) {
                res = this._itemsByKey[path[0]].getItem(path.slice(1));
            }
        }
        return res;
    }

    /**
     * Adds a menu item at the specified path.
     * @param {string|string[]} path - The path to the menu item, either as a string (with '/' separators) or an array of strings.
     * @param {MenuItemOptions} option - The options for the menu item to add.
     */
    addItemAtPath(path, option) {
        let item = this.getItem(path);
        if (item) {
            if (item == this) {
                this.addItem(option);
            } else if (!item.subMenu) {
                item.subMenu = [option];
            } else {
                item.subMenu.addItem(option);
            } 
            return true;
        }
        return false;
    }

    /**
     * Adds multiple menu items at the specified path.
     * @param {string|string[]} path - The path to the menu item, either as a string (with '/' separators) or an array of strings.
     * @param {MenuItemOptions[]} optionsArray - An array of menu item options to add.
     * @param {number} index - The index at which to add the items.
     */
    addItemsAtPath(path, optionsArray) {
        let item = this.getItem(path);
        if (item) {
            if (item == this) {
                this.addItems(optionsArray);
            } else  if (!item.subMenu) {
                item.subMenu = optionsArray;
            } else {
                item.subMenu.addItems(optionsArray);
            }
            return true;
        }
        return false;
    }

    get items() {
        return [...this._itemsList].filter(i => !i.hidden);
    }
}