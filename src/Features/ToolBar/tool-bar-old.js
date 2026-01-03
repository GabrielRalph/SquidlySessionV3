
import {SvgPlus, Vector} from "../../SvgPlus/4.js"
import {ShadowElement} from "../../Utilities/shadow-element.js"
import { Icon } from "../../Utilities/Icons/icons.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";
import { AccessButton, AccessClickEvent } from "../../Utilities/Buttons/access-buttons.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";

/**
 * @typedef {Object} IconsDescription
 * @property {import("../../Utilities/Icons/icons-library.js").IconName} name
 * @property {[IconsDescription]} icons
 * @property {string} key
 * @property {string} text
 * @property {string} color
 * @property {string} notification
 * @property {string} notificationColor
 * @property {string} notifcationTextColor
 * @property {boolean} hidden
 */

/**
 * @typedef {Object} IconsDescriptionObject
 * @property {import("../../Utilities/Icons/icons-library.js").IconName} name
 * @property {Object.<string, IconsDescriptionObject>} icons
 * @property {string} key
 * @property {string} text
 * @property {string} color
 * @property {string} notification
 * @property {string} notificationColor
 * @property {string} notifcationTextColor
 * @property {boolean} hidden
 * @property {IconsDescriptionObject} setter
 */

/**
 * @type {[IconsDescription]}
 */
const ICONS_SMALL = [
    {
        name: "control",
        icons: [
            {
                key: "video",
                name: "novideo"
            },
            {name: "key"},
            {
                name: "tools-unlocked",
                key: "lock-tools",
                text: "lock tools",
            },
            {
                name: "mute",
                key: "audio",
            },

        ]
    },
    {
        name: "access",
        color: "blue",
        icons: [
            {
                name: "calibrate",
                color: "danger"
            },
            {
                name: "eye",
                key: "eye",
                text: "eye-gaze"
            },
            {
                name: "switch"
            },
            {
                name: "aac"
            }
        ]
    },
    {
        name: "share",
        notificationColor: "var(--color-red1)",
        color: "orange",
        icons: [
            {
                name: "screen",
                notificationColor: "var(--color-red1)",
            },
            {
                name: "file"
            },
            {
                name: "apps", 
                hidden: true
            },
            {
                name: "quiz"
            },
        ]
    },
    {name: "settings"},
    {
        name: "end",
        color: "red"
    },
]


const default_icon = [
    {
        key: "name",
        required: true,
    },
    {
        key: "key",
        defualt: (i) => i.name,
        required: false,
    },
    {
        key: "text",
        defualt: (i) => i.key,
        required: false,
    },
    {
        key: "hidden",
        defualt: (i) => false,
        required: false,
    },
    {
        key: "color",
        defualt: (i) => null,
        required: false,
    },
    {
        key: "notification",
        defualt: (i) => null,
        required: false,
    },
    {
        key: "notificationColor",
        defualt: (i) => "blue",
        required: false,
    },
    {
        key: "notificationTextColor",
        defualt: (i) => "white",
        required: false,
    },
    {
        key: "icons",
        defualt: (i) => [],
        required: false,
    }

]
/**
 * @param {[IconsDescription]} icons
 * @param {Function} changeCallback
 * 
 * @return {[[IconsDescription], Object.<string, IconsDescriptionObject>]}
 */
function parse_icons(icons, changeCallback) {
    let nicons = [];
    let iconsSetters = {};

    for (let icon of icons) {
        let nicon = {}
        let nIconSetter = {}
        for (let prop of default_icon) {
            if (!(prop.key in icon)) {
                if (prop.required) {
                    nicon = null;
                    break;
                } else {
                    
                    nicon[prop.key] = prop.defualt(nicon)
                }
            } else if (prop.key != "icons") {
                nicon[prop.key] = icon[prop.key];
            }

            let property = {}
            if (prop.key == "icons" && "icons" in icon) {
                let [subnicons, subsetters] = parse_icons(icon.icons, changeCallback);
                nicon[prop.key] = subnicons;
                property = {get: () => subsetters}
            } else if (prop.key != "key") {
                property =  {
                    get: () => nicon[prop.key],
                    set: (value) => {
                        nicon[prop.key] = value
                        if (changeCallback instanceof Function) {
                            changeCallback();
                        }
                    }
                }
            } else {
                property = {get: () => nicon[prop.key]}
            }
            Object.defineProperty(nIconSetter, prop.key, property);
        }

        if (nicon != null) {
            nicons.push(nicon);
            nicon.setter = nIconSetter;
            Object.defineProperty(iconsSetters, nicon.key, {
                get: () => nIconSetter,
            })
        }
    }

    return [nicons, iconsSetters];
}


class IconSelectionEvent extends AccessClickEvent {
    /**
     * @param {IconsDescription} icon
     * @param {[number]} path
     * @param {boolean} safe If set true stores only the setter 
     *                       icon description object.
     * @param {string} clickType 
     */
    constructor(oldEvent, icon, path, safe = false){
        super(oldEvent);
        this.icon = safe ? icon.setter : icon;
        this.iconPath = path;
    }
}


class ToolBarIcon extends AccessButton {
    /** @type {Icon}*/
    icon = null;

    /**
     * @param {IconsDescription}
     */
    constructor(icon, isRing = false) {
        super(isRing ? "toolbar-ring" : "toolbar");
        this.class = "tool-bar-icon"
        this.props = {
            color: icon.color
        }
        this.value = icon;
        let ibox = this.createChild("div", {class: "icon-box"})
        this.icon = ibox.createChild(Icon, {}, icon.name);
        this.createChild("div", {content: icon.text, class: "hint"});
        ibox.createChild("div", {
            class: "notification",
            shown: icon.notification != null,
            content: icon.notification,
            styles: {
                background: icon.notificationColor,
                color: icon.notificationTextColor,
            }
        })
    }
}


class ToolBarRingIcon extends ToolBarIcon {
    constructor(icon, angle) {
        super(icon, true);
        this.styles = {
            "--angle": `${180 * angle / PI}deg`,
            "--cos-t": Math.cos(angle),
            "--sin-t": Math.sin(angle),
        }   
    }

    getCenter() {
        let [pos, size] = this.icon.bbox;
        return pos.add(size.div(2))
    }
}



const {PI} = Math;
class ToolBarRing extends ShadowElement {
    /** @type {[IconsDescription]} */
    _icons = []

    /** @type {[number]} */
    iconPath = []

    /** @type {ToolBarFeature} */
    tools = null

    constructor(session) {
        super("tool-bar-ring");
        this.tools = session;

        /** @type {HideShowTransition} */
        this.ring = this.createChild(HideShowTransition, {
            style: { "pointer-events": "all" }
        }, "ring-selector");
       
     

        // Build ring icon svg element structure.
        this.ringIconSvg = this.ring.createChild("svg", {class: "ring-icon"});
        this.clickBoxesG = this.ringIconSvg.createChild('g', {class: "click-boxes"});
        this.outlinesG = this.ringIconSvg.createChild('g', {class: "outlines"});

        // Create ring icons container
        this.ringIcons = this.ring.createChild("div", {display: "contents"})

        // Attach resize observer to re-render the svg ring icon
        // when tool bar ring area changes
        const resizeObserver = new ResizeObserver((entries) => {
            this.renderRing();
        });
        resizeObserver.observe(this);
    }

    /** Renders the svg ring elements */
    renderRing(){
        let {ringIconSvg, clickBoxesG, outlinesG, n, iconElements} = this;

        // Exit if there are no icons
        if (n == 0) return;

        // Get the size of the tool bar ring area
        let size = this.bbox[1];
        let s = size.div(2);

        // Compute the two radius 
        // - r0 is the radius the extends beyond the screen.
        let r0 = size.norm();           
        // - r1 is the radius of the cancel button
        let r1 = Math.min(s.x, s.y) / 3;

        // Radius vector along horizontal axis.
        let radVecs = [new Vector(r0, 0), new Vector(r1, 0)];

        // Update the svg viewbox and clear the click boxe and
        // outline groups.
        ringIconSvg.props = {
            viewBox: `${-s.x} ${-s.y} ${size.x} ${size.y}`
        }
        clickBoxesG.innerHTML = "";
        outlinesG.innerHTML = "";
        
        // For each n icons
        for (let i = 0; i < n; i++) {
            // calculate the angles at the start and end of each segment
            let angles = [i-0.5, i+0.5].map(ai => (2 * PI * ai/n - PI / 2))

            // calculate the vectors at the start and end points of the segment 
            // for both the r0 and r1
            let [[rv0_start, rv1_start],
                [rv0_end, rv1_end]] = angles.map(a => radVecs.map(rv => rv.rotate(a)));

            // create scoped index variable
            let idx = i;

            // Create the click box path for the ith segment.
            let dpath = `M${rv1_start}A${r1},${r1},0,0,1,${rv1_end}L${rv0_end}A${r0},${r0},0,0,0,${rv0_start}Z`;
            let clickBox = clickBoxesG.createChild("path", {
                d: dpath, 
                events: {
                    click: () => this.onClickBoxClick(idx),
                    mouseenter: () => this.onClickBoxEnter(idx),
                    mouseout: () => this.onClickBoxLeave(idx)
                }
            })
            iconElements[i].clickBoxElement = clickBox;

            // Create the outline for the ith segment
            outlinesG.createChild("path", {
                d: dpath, 
            })
        }

        // Create the cancel click box and outline
        let cancelClickBox = clickBoxesG.createChild("circle", {
            r: r1,
            events: {
                click: () => this.onClickBoxClick(n),
                mouseenter: () => this.onClickBoxEnter(n),
                mouseout: () => this.onClickBoxLeave(n)
            }
        })
        iconElements[n].clickBoxElement = cancelClickBox;
        outlinesG.createChild("circle", {r: r1})
    }

    /** Called when the mouse clicks an a click box
     * @param {number} i the index of the icon
     */
    onClickBoxClick(i) {
        // If the cancel icon has been clicked hide the ring icons
        if (i == this.n) {
            this.toggle(false);

        // otherwise dispatch the click event.
        } else {
            this.dispatchEvent(new IconSelectionEvent("click", this.icons[i], [...this.iconPath, i]))
        }
    }

    /** Called when the mouse enters a click box
     * @param {number} i the index of the icon
     */
    onClickBoxEnter(i) {
        this.highLightIcon(i, true);
    }

    /** Called when the mouse leaves a click box
     * @param {number} i the index of the icon
     */
    onClickBoxLeave(i) {
        this.highLightIcon(i, false);
    }

    /** Toggle whether an icon is highlighted or not
     * @param {number} i the index of the icon
     * @param {boolean} bool whether the icon should be highlighted
     * @param {("hover"|"highlight")} mode 
     */
    highLightIcon(i, bool, mode = "hover") {
        for (let key of ["iconElements", "outlines", "clickBoxes"]) {
            this[key][i].toggleAttribute(mode, bool);
        }
    }

    /** Sets the icons list
     * @param {[IconsDescription]} icons
     */
    set icons(icons) {
        // Remove hidden icons.
        icons = icons.filter(i => !i.hidden);

        // Store filtered icons. 
        this._icons = icons;

        // Clear the ring icons container.
        this.ringIcons.innerHTML = "";

        // For each icon
        icons.forEach((icon, i) => {
            let idx = i;
            
            // Create a respective tool bar icon.
            let iconButton = this.ringIcons.createChild(ToolBarRingIcon, {
                events: {
                    "access-click": (e) => {
                        this.dispatchEvent(new IconSelectionEvent(e, icon, [...this.iconPath, idx]))
                    }
                },
            }, icon, i * 2 * PI / icons.length - PI / 2);
            iconButton.setHighlight = (bool) => this.highLightIcon(idx, bool, "highlight");
        })
        
        // Create cancel buttons
        let button = this.ringIcons.createChild(AccessButton, {class: "cancel", events: {
            "access-click": (e) => {
                e.waitFor(Promise.all([
                    this.toggle(false),
                    this.tools.toggleToolBar(true)
                ]));
            }
        }}, "toolbar-ring")
        this.cancelIcon = button.createChild(Icon, {}, "close");
        button.setHighlight = (bool) => this.highLightIcon(this.n, bool, "highlight");


        this.renderRing();
    }

    /** Returns the icons list.
     * @return {[IconsDescription]}
     */
    get icons(){return this._icons}


    /** Returns the number of icons
     * @return {}
     */
    get n(){    
        return this._icons.length;
    }

    /** Return the list of icon elements
     * @return {[ToolBarIcon]}
    */
    get iconElements(){
        return this.ringIcons.children;
    }

    /** Return the list of click box elements
     * @return {[SvgPlus]}
    */
    get clickBoxes(){
        return this.clickBoxesG.children;
    }

    /** Return the list of outline elements
     * @return {[SvgPlus]}
    */
    get outlines(){
        return this.outlinesG.children;
    }

    /** Returns whether the element is hidden or shown/
     * @return {boolean}
     */
    get shown(){
        return this.ring.shown;
    }

    /** Toggle, toggles the elements visibility
     * @param {boolean} bool if true the element will
     *                       be shown otherwise hidden
     * @return {Promise}
     */
    async toggle(bool){
        return await this.ring.toggle(bool, 400);
    }

    static get usedStyleSheets(){
        return [relURL("./tool-bar-styles.css", import.meta)]
    }
}


class ToolBar extends ShadowElement {
    constructor(){
        super("tool-bar");
    }


    /**
     * @param {[IconsDescription]} icons
     */
    set icons(icons){
        this.root.innerHTML = "";
        let i = 0;
        for (let icon of icons) {
            let path = [i];
            this.createChild(ToolBarIcon, {
                events: {
                    "access-click": (e) => this.dispatchEvent(new IconSelectionEvent(e, icon, path)),
                }
            }, icon);
            i++;
        }
    }



    static get usedStyleSheets(){
        return [relURL("./tool-bar-styles.css", import.meta)]
    }
}


class GestureRecogniser {
    buffer = []
    listeners = []
    timeoutID
    addGestureListener(cb){
        if (cb instanceof Function) {
            this.listeners.push(cb);
        }
    }

    addTouchEvent(e) {
        if (e.type == "touchend") {
            this.checkForGesture();
        } else {
            this.buffer.push(e);
            clearTimeout(this.timeoutID);
            this.timeoutID = setTimeout(() => {
                this.checkForGesture();
            }, 300)
        }
    }

    get firstTouchPoints() {
        return this.buffer.map(te => new Vector(te.touches[0].clientX, te.touches[0].clientY));
    }

    getAvgSize(){
        let points = this.firstTouchPoints;
        let n = points.length;
        let xmean = points.reduce((a, b) => a.add(b)).div(n);
        let avgErr = points.map(p => p.sub(xmean).abs()).reduce((a, b) => a.add(b)).div(n);
        return [xmean, avgErr, points[0], points[n-1], n];
    }

    checkForGesture(){
        let res = this.getAvgSize()
        
        for (let cb of this.listeners) {
            cb(res);
        }
        
        this.buffer = [];
    }
}


export default class ToolBarFeature extends Features {
    selectionListeners = {};

    mouseY = null;
    eyeY = null;
    _locked = false;
    toolbarHideDelay = 2000;

    /** @param {import("../features-interface.js").SquidlySession} session */
    constructor(session, sdata){
        super(session, sdata);

        let toolBar = new ToolBar(this);
        let toolBarRing = new ToolBarRing(this);

        let [icons, iconsEditor] = parse_icons(ICONS_SMALL, () => {
            this.toolBar.icons = icons;
            if (this.toolBarRing.shown) {
                let i = this.toolBarRing.iconPath[0];
                
                if (icons[i].icons.length > 0) {
                    this.toolBarRing.icons = icons[i].icons
                } else {
                    this.toolBarRing.toggle(false);
                }
            }
        })

        this._iconsEditor = iconsEditor

        toolBar.icons = icons;

        // Icon selection events
        let iselect = (e) => {
            
            // Icon was selected that has a sub selection.
            if (Array.isArray(e.icon.icons) && e.icon.icons.length > 0) {

                let proms = []
                // If it was a switch click hide the toolbar.
                if (e.clickMode == "switch") {
                    proms.push(session.togglePanel("toolBarArea", false));
                }

                // Show subselection ring icons
                toolBarRing.iconPath = e.iconPath;
                toolBarRing.icons = e.icon.icons;
                proms.push(toolBarRing.toggle(true));
                
                e.waitFor(Promise.all(proms))

            // Icon was a final selection so dispatch an event 
            // for other apps to use.
            } else {
                this._dispatchIconSelectionEvent(e);
            }
        }
        toolBar.addEventListener("access-click", iselect);
        toolBarRing.addEventListener("access-click", iselect);

        // Events regarding bringing up the toolbar.
        toolBarRing.addEventListener("sv-mousemove", (e) => {
            this.mouseY = e.y;
        })

        toolBarRing.addEventListener("sv-mouseleave", (e) => {
            this.mouseY = null;
        })

        let gestures = new GestureRecogniser();
        gestures.addGestureListener((res) => {
            let [mean, gs, start, end, n] = res;
            let sratio = gs.x / gs.y;
        
            if (sratio < 0.5 && gs.y > 10) {
                session.togglePanel("toolBarArea", start.y > end.y);
            }
        })

        toolBarRing.addEventListener("sv-touchmove", (e) => {
            if (!this.toolbarFixed)
                gestures.addTouchEvent(e);
        })
        
        this.toolBar = toolBar;
        this.toolBarRing = toolBarRing
    }

    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
   
    addSelectionListener(name, cb) {
        if (cb instanceof Function) {
            if (!(name in this.selectionListeners)) {
                this.selectionListeners[name] = new Set();
            }
            this.selectionListeners[name].add(cb)
        }
    }


     /** Sets an icons properties at a given path
     * 
     * @param {string} path e.g. share/files/notification
     * @param {number|string|bool} value e.g. "3"
     */
     setIcon(path, value) {
        let icons = this.icons;
        path = path.split("/");
        while (path.length > 1) {
            let key = path.shift();
            if (key in icons) {
                icons = icons[key]
            } else if (key in icons.icons) {
                icons = icons.icons[key]
            }
        }
        let key = path.shift();
        if (key in icons) icons[key] = value;
    }

   
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ SET/GETTERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


   


    /** Can also be used to set icon properties
     * @return {Object.<string, IconsDescriptionObject>} 
     * */
    get icons(){
        return this._iconsEditor;
    }
    

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    set toolbarFixed(bool){
        this._toolbarFixed = bool
    }
    get toolbarFixed(){
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

    _dispatchIconSelectionEvent(e){
        const event = new IconSelectionEvent(e, e.icon, e.iconPath, true);
        // this.toggleRingBar(false)
        event.waitFor(this.toggleRingBar(false));
        // Create icon selection event
        
        let key = e.icon.key || e.icon.name;
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
   
    initialise(){
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
            this.session.toolBar.setIcon("control/lock-tools/name", locked ? "tools-locked" : "tools-unlocked");
            this.session.toolBar.setIcon("control/lock-tools/text", locked ? "unlock tools" : "lock tools");
        });
        this.addSelectionListener("lock-tools", (e) => {
            this._locked = !this._locked;
            this.session.toolBar.setIcon("control/lock-tools/name", this._locked ? "tools-locked" : "tools-unlocked");
            this.session.toolBar.setIcon("control/lock-tools/text", this._locked ? "unlock tools" : "lock tools");

            this.sdata.set("locked", this._locked);
        });

        this._start();
    }

    async _start(){
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

    // static get name(){
    //     return "toolBar";
    // }

    static get firebaseName(){ 
        return "tool-bar";
    }
    static get privatePropertyNames() {
        return ["toolbarFixed", "fixToolBar", "toggleRingBar", "toggleToolBar"]
    }

    static async loadResources(){
        await ToolBar.loadStyleSheets();
    }
}
