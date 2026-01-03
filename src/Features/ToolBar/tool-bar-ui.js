import {SvgPlus, Vector} from "../../SvgPlus/4.js"
import {ShadowElement} from "../../Utilities/shadow-element.js"
import { Icon } from "../../Utilities/Icons/icons.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { AccessButton, AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { Menu, MenuItem } from "./menu.js";


class MenuItemSelectionEvent extends AccessEvent {
    /**
     * @param {MenuItem} item
     * @param {[number]} path
     */
    constructor(oldEvent, item){
        super("item-select", oldEvent, {bubbles: true});
        this.item = item;
    }
}


function makeEvent(oldEvent, item) {
    return new MenuItemSelectionEvent(oldEvent, item);
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
        this.icon = ibox.createChild(Icon, {}, icon.symbol);
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
export class ToolBarRing extends ShadowElement {
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
            this.dispatchEvent(makeEvent("click", this.icons[i]))
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
     * @param {Menu} icons
     */
    set menu(menu) {
        if (!(menu instanceof Menu)) {
            this._menu = null;
            return 
        }
        this._menu = menu;
        let icons = menu.items;
        // Remove hidden icons.

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
                        this.dispatchEvent(makeEvent(e, icon))
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

    get menu(){return this._menu;}

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


export class ToolBar extends ShadowElement {
    constructor(){
        super("tool-bar");
    }


    /**
     * @param {Menu} menu
     */
    set menu(menu){
        const items = menu.items
        this.root.innerHTML = "";
        let i = 0;
        for (let icon of items) {
            this.createChild(ToolBarIcon, {
                events: {
                    "access-click": (e) => this.dispatchEvent(makeEvent(e, icon)),
                }
            }, icon);
            i++;
        }
    }



    static get usedStyleSheets(){
        return [relURL("./tool-bar-styles.css", import.meta)]
    }
}


export class GestureRecogniser {
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