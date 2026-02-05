import { delay } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";
import { AccessClickEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GestureRecogniser, ToolBar, ToolBarRing } from "./tool-bar-ui.js";
import { Menu } from "./menu.js";
import { Vector } from "../../SvgPlus/vector.js";

/**
 * @type {[IconsDescription]}
 */
const MENU_DEFAULT = [
    {
        name: "control",
        subMenu: [
            {
                name: "key",
                index: 90
            },
            {
                symbol: "tools-unlocked",
                name: "lock-tools",
                text: "lock tools",
                index: 180
            }
        ],
        index: 10
    },
    {
        name: "access",
        color: "blue",
        index: 20,
    },
    {
        name: "share",
        notificationColor: "var(--color-red1)",
        color: "orange",
        index: 30,
    },
    {
        name: "end",
        color: "red",
        index: 40,
    },
]


export default class ToolBarFeature extends Features {
    selectionListeners = {};

    mouseY = null;
    eyeY = null;
    _locked = false;
    toolbarHideDelay = 2000;

    /** 
     * @param {import("../features-interface.js").SquidlySession} session 
     * */
    constructor(session, sdata) {
        super(session, sdata);

        let toolBar = new ToolBar(this);
        let toolBarRing = new ToolBarRing(this);


        let menu = new Menu(MENU_DEFAULT)
        menu.onUpdate = () => {
            toolBar.menu = menu;
            toolBarRing.menu = toolBarRing.menu;
        }
        toolBar.menu = menu;
        this._menu = menu;


        let gestures = new GestureRecogniser();
        gestures.addGestureListener((res) => {
            let [mean, gs, start, end, n] = res;
            let sratio = gs.x / gs.y;

            if (sratio < 0.5 && gs.y > 10) {
                session.togglePanel("toolBarArea", start.y > end.y);
            }
        })

        toolBarRing.events = {
            "sv-mousemove": (e) => this.mouseY = e.y,
            "sv-mouseleave": (e) => this.mouseY = null,
            "item-select": this._onInteraction.bind(this),
            "sv-touchmove": (e) => {
                if (!this.toolbarFixed)
                    gestures.addTouchEvent(e);
            }
        }
        toolBar.events = {
            "item-select": this._onInteraction.bind(this)
        }


        this.toolBar = toolBar;
        this.toolBarRing = toolBarRing
    }


    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /**
     * Adds a listener for when a menu item is selected.
     * @param {string} name The name of the menu item to listen for.
     * @param {(e: AccessClickEvent) => void} cb The callback function to execute when the menu item is selected.
     */
    addSelectionListener(name, cb) {
        if (cb instanceof Function) {
            if (!(name in this.selectionListeners)) {
                this.selectionListeners[name] = new Set();
            }
            this.selectionListeners[name].add(cb)
        }
    }

    /** 
     * Sets an icons properties at a given path
     * @param {string} path e.g. share/files/notification
     * @param {number|string|bool} value e.g. "3"
     */
    setMenuItemProperty(path, value) {
        path = typeof path === "string" ? path.split("/") : path;
        let prop = path.pop();
        let item = this._menu.getItem(path);
        if (item && prop in item) {
            item[prop] = value;
        }
    }

    /**
     * Adds a menu item at a given path
     * @param {string|string[]} path
     * @param {MenuItemOptions} options
     */
    addMenuItem(path, options) {
        try {
            this._menu.addItemAtPath(path, options)
        } catch (e) {
            console.error("Error adding menu item at path", path, e);
        }
    }

    /**
     * Adds multiple menu items at a given path
     * @param {string|string[]} path
     * @param {MenuItemOptions[]} optionsArray
     */
    addMenuItems(path, optionsArray) {
        try {
            this._menu.addItemsAtPath(path, optionsArray)
        } catch (e) {
            console.error("Error adding menu items at path", path, e);
        }
    }

    /**
     * Removes a menu item at a given path
     * @param {string|string[]} path
     */
    removeMenuItem(path) {
        let item = this._menu.getItem(path);
        if (item) {
            item.remove();
        }
    }


    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    _onInteraction(e) {
        const { item } = e;
        if (item.isSubMenu) {
            this.toolBarRing.menu = item.subMenu;
            e.waitFor(this.toggleRingBar(true));
            if (e.clickMode == "switch") {
                e.waitFor(session.togglePanel("toolBarArea", false));
            }
        } else {
            item.onSelect(e);
            this._dispatchMenuItemSelectionEvent(e);
        }
    }

    set toolbarFixed(bool) {
        this._toolbarFixed = bool
    }
    get toolbarFixed() {
        return this._toolbarFixed;
    }


    get isRingShown() {
        return this.toolBarRing.shown;
    }

    async toggleToolBar(bool) {
        await this.session.togglePanel("toolBarArea", bool);
    }

    async toggleRingBar(bool) {
        await this.toolBarRing.toggle(bool);
    }

    fixToolbar(isFixed) {
        this.toolbarFixed = isFixed;
    }

    _dispatchMenuItemSelectionEvent(e) {
        const event = new AccessClickEvent("item-select", e);

        event.waitFor(this.toggleRingBar(false));

        let key = e.item.name;
        if (key in this.selectionListeners) {
            let listeners = this.selectionListeners[key];
            for (let listener of listeners) {
                listener(event);
                if (e.cancelBubble) {
                    return;
                }
            }
        }

        this.dispatchEvent(event);
    }

    initialise() {
        // Events regarding bringing up the toolbar.
        this.session.eyeGaze.addEyeDataListener((v, bbox) => {
            let eyeY = null;
            if (v instanceof Vector && v.y < 1) {
                eyeY = v.y * bbox[1].y;
            }
            this.eyeY = eyeY;
        })

        this.sdata.onValue("locked", (locked) => {
            this._locked = locked;
            this.setMenuItemProperty("control/lock-tools/symbol", locked ? "tools-locked" : "tools-unlocked");
            this.setMenuItemProperty("control/lock-tools/text", locked ? "unlock tools" : "lock tools");
        });
        this.addSelectionListener("lock-tools", (e) => {
            this._locked = !this._locked;
            this.setMenuItemProperty("control/lock-tools/symbol", this._locked ? "tools-locked" : "tools-unlocked");
            this.setMenuItemProperty("control/lock-tools/text", this._locked ? "unlock tools" : "lock tools");
            this.sdata.set("locked", this._locked);
        });

        this._start();
    }

    async _start() {
        let show = false;
        let delayTime = 0;
        while (true) {
            if (!this.toolbarFixed) {
                let [pos, size] = this.toolBarRing.bbox;
                let [pos2, size2] = this.toolBar.bbox;
                let yMin = pos.add(size).sub(size2).y;
                let isEye = this.eyeY == null ? false : this.eyeY > yMin;
                let isMouse = this.mouseY == null ? false : this.mouseY > yMin;
                let nextShow = isEye || isMouse || this._locked;

                if (!show && nextShow) {
                    delayTime = this.toolbarHideDelay;
                }

                nextShow = nextShow || delayTime > 0;

                show = nextShow;
                this.session.togglePanel("toolBarArea", show);
            }
            let t0 = window.performance.now();
            await delay();
            delayTime -= window.performance.now() - t0;
            delayTime = Math.max(0, delayTime);
        }
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get layers() {
        return {
            toolBar: {
                type: "panel",
                area: "tools",
            },
            toolBarRing: {
                type: "area",
                area: "mainScreen",
                mode: "overlay",
                index: 220,
            }
        }
    }

    static get name() {
        return "toolBar";
    }

    static get firebaseName() {
        return "tool-bar";
    }
    static get privatePropertyNames() {
        return ["toolbarFixed", "fixToolBar", "toggleRingBar", "toggleToolBar"]
    }

    static async loadResources() {
        await ToolBar.loadStyleSheets();
    }
}
