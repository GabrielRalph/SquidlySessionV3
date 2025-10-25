import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { Icon } from "../Utilities/Icons/icons.js";
import { ShadowElement } from "../Utilities/shadow-element.js";
import { relURL, WaveStateVariable, getDevice, delay } from "../Utilities/usefull-funcs.js";

/** @typedef {("entireScreen"|"fullAspectArea"|"fixedAspectArea"|"mainScreen"|"popupArea")} ScreenAreaName*/
/** @typedef {("sideScreen"|"topPanel"|"sidePanel"|"bottomPanel"|"toolBarArea")} HideableElement*/
const ScreenAreaNames = {
    entireScreen: "entire-screen",
    fullAspectArea: "full-aspect-area",
    fixedAspectArea: "fixed-aspect-area",
    mainScreen: "main-screen",
    popupArea: "popup-area"
}

function copyEvent(event) {
    let json = {}
    for (let key in event) json[key] = event[key];
    json.bubbles = false;
    let copyevent = new event.__proto__.constructor("sv-" + json.type, json);
    copyevent.sessionView = true;
    return copyevent
}

function isTouch(e) {
    if (Window.TouchEvent) return e instanceof TouchEvent
    else return "touches" in e;
}

class SlidePanel extends SvgPlus {
    /** Constructs a new SidePanel with the provided name.
     * @param {("side"|"top")} name determines whether it is a vertial of horizontal panel
     * @param {SessionView} sview reference to the session view parent 
     * @param {string} tagName optional provide a specific tag name
     */
    constructor(name, sview, tagName = name+"-panel") {
        super(tagName);
        this.sview = sview;
        this.panelType = name;
        this.tName = tagName;

        let device = getDevice();
        this.isTouch = device != "computer"
        
        // Create Slider Elements
        this.slider = this.createChild("div", {class: "panel-slider"});
        this.sliderExtentWSV = new WaveStateVariable(this.isTouch, 0.3, (t) => {
            this.styles = {
                "--panel-slider-extension-p": t,
            }
        });
        this.sliderIconScaleWSV = new WaveStateVariable(0, 0.1, (t) => {
            this.styles = {
                "--slider-icon-scale": t
            }
        })
        this.sliderClickBox = this.slider.createChild("div",{ 
            class: "panel-slider-clickbox",
            events: {
                touchstart: (e) => this.startDrag(e),
                mousedown: (e) => this.startDrag(e), 
                mouseover: (e) => this.showSlider(true),
                mouseleave: (e) => this.showSlider(false)
            }
        })

        // Create Content Element
        this.content = this.createChild("div", {class: "rel"});
    }

    /** showSlider will show or hide the slider with a transition
     *  @param {boolean} bool whether to show or hide the slider
     */
    async showSlider(bool){
        await this.sliderExtentWSV.set(bool || this.isTouch);
    }

    /** sizeToPoint will resize the panel to position the slider at the 
     * provided point.
     *  @param {Vector} e the point to meet
     *  @param {Vector} sOffset an offset from the slider position
     *  @param {number} t the amount the offset whould be used
     */
    async sizeToPoint(...args) {
        this._sizingParams = args
        if (this._sizing) return 
        this._sizing = true;
        await delay()
        let [e, sOffset, t] = this._sizingParams;

        // Compute the distance from the edge of the panel to the center of the slider
        let dOffset = this.sliderClickBox.bbox[1].div(2);

        // We will adjust the offset from the offset the user started at to the 
        // an offset the will make the users cursor in the center of the slider
        let offset = dOffset.mul(t).add(sOffset.mul(1 - t))
        let b = this.bbox;

        let size = 0;
        switch (this.panelType) {
            case "top":
                // Compute the height of the pannel such the slider is under the mouse location
                size = e.y - b[0].y + offset.y;
                break;

            case "side": 
                // Compute the width of the pannel such the slider is under the mouse location
                size = b[0].x + b[1].x - e.x + offset.x;
                break;
        }

        // Update the css variable to adjust the size of the panel
        this.sview.root.styles = {
            [`--${this.tName}-desired`]: `${size}px`
        }
        this._sizing = false;
    }

    /** Called by the eventlistener, begins the resizing.
     * @param {TouchEvent|MouseEvent} start
     */
    startDrag(start) {
        start.preventDefault();
        this.sliderIconScaleWSV.set(1);

        // If called by a touch event then retreive the touch position
        let v;
        if (isTouch(start)) {
            let t1 = start.changedTouches[0];
            let {clientX, clientY} = t1;
            v = new Vector(clientX, clientY);
        }else {
            v = new Vector(start);
        }
        // compute the starting offset from the edge of the panel
        let [spos, ssize] = this.sliderClickBox.bbox;
        if (this.panelType == "top") spos = spos.add(ssize);
        let startOffset = v.sub(spos);
        startOffset.y = startOffset.y * -1;

        // This event callback will be called when the user moves the mouse
        let i = 0;
        let mouseMove = (e) => {
            e.preventDefault();

            // compute a transition variable t in (0, 1)
            // this will be used to adjust the offset and will
            // reach a value of 1 after 20 mouse move events
            let t = i / 20;
            t = t > 1 ? 1 : t;
            i++;

            // If it is a touch event retreive the touch position
            if (isTouch(e)) {
                let t1 = e.changedTouches[0];
                let {clientX, clientY} = t1;
                e = new Vector(clientX, clientY);
            }

            // size the panel accordingly
            this.sizeToPoint(e, startOffset, t)
        }

        // When the user is done moving the slider remove the event listeners from the window
        let mouseUp = (e) => {
            e.preventDefault();
            this.sliderIconScaleWSV.set(0);
            window.removeEventListener("mousemove", mouseMove)
            window.removeEventListener("touchmove", mouseMove)
            window.removeEventListener("mouseup", mouseUp)
            window.removeEventListener("touchend", mouseUp)
            window.removeEventListener("mouseleave", mouseUp)
        }
        
        // Add the mouse event listeners to the window
        window.addEventListener("mousemove", mouseMove);
        window.addEventListener("touchmove", mouseMove, {passive: false});
        window.addEventListener("mouseup", mouseUp);
        window.addEventListener("mouseleave", mouseUp);
        window.addEventListener("touchend", mouseUp)

    }
}

class SideScreenPanel extends SvgPlus {

    /** Constructs a new side screen panel.
     * @param {string} title of side screen panel
     * @param {ShadowElement} content of side screen panel 
     * @param {boolean} transition if true the side screen panel will
     * transition to being shown on creation.
     */
    constructor(title, content, transition) {
        super("side-screen-panel");
        // used for hide/show transition
        this.hideWSV = new WaveStateVariable(!transition, 0.3, (t) => {
            this.styles = {"--hide-p": t}
        })

        // create title box
        let titleBox = this.createChild("div", {class: "title-box"});
        titleBox.createChild("span", {class: "title-text", content: title});

        // create close icon, when clicked dispatch "close" event
        titleBox.createChild(Icon, {
            events: { click: () => this.dispatchEvent(new Event("close")) }
        }, "close");

        // create content box and append content
        let contentBox = this.createChild("div", {class: "rel content-box"})
        contentBox.appendChild(content);

        // set transition variable to show 
        this.hideWSV.set(true);
    }

    /** Removes itself by first transitioning to hidden 
     * them removing from DOM. */
    async removeTransition(){
        await this.hideWSV.set(false);
        
        this.remove();
    }
}

class SideScreen extends SlidePanel {
    panels = new Map();
    /** Constructs a new SideScreen.
     * @param {SessionView} sview reference to the session view parent 
     */
    constructor(sview) {
        super("side", sview, "side-screen")
        this.content.class = "side-screen-content";
    }

    /** adds a new side screen panel with content and title provided. 
     * If the side screen is shown a transition will be used, otherwise
     * it will add imeditely. When the close icon is clicked on the new 
     * panel it will be removed from the side screen.
     * @param {string} title name of the side screen panel
     * @param {ShadowElement} content content of the side screen panel
     */
    async add(title, content) {
        let panel = this.content.createChild(SideScreenPanel, {
            events: {
                "close": () => this.sview.removeSideScreenPanel(content)
            }
        }, title, content, this.isVisible);
        this.panels.set(content, panel);
        await panel.hideWSV.waitTransition();
    }

    /** delete removes a side screen panel (if it exists) associated with 
     * the content provided.  If the side screen is shown a transition will 
     * be used, otherwise it will remove imeditely. 
     * @param {ShadowElement} content reference to the side screen panel content
     */
    async delete(content) {
        if (this.panels.has(content)) {
            let panel = this.panels.get(content);
            this.panels.delete(content);
            if (this.isVisible) {
                await panel.removeTransition();
            } else {
                panel.remove();
            }
        }
    }

    /** The number of side screen panels, excluding panels 
     * in the process of being removed
     * @return {number}
     */
    get length() {
        return this.panels.size;
    }
}

export class SessionView extends ShadowElement {
    transitionObjects = {}
    screenAreas = new Map();
    constructor(){
        super("session-view");
        
        // Create all the panels
        let link = this.root.createChild("link", {
            rel: "stylesheet",
            href: relURL("../../Fonts/OpenDyslexic/od3.css", import.meta)
        })
        document.head.appendChild(link);
        document.head.innerHTML += `<link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&family=Inclusive+Sans:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet"></link>`

        let sideScreen = this.root.createChild(SideScreen, {}, this);
        let topPanel = this.root.createChild(SlidePanel, {}, "top", this);
        let sidePanel = this.root.createChild(SlidePanel, {}, "side", this);
        let bottomPanel = this.root.createChild("bottom-panel");
        bottomPanel.content = bottomPanel.createChild("div", {class: "rel"});
        let toolBarArea = this.root.createChild("tool-bar-area");
        toolBarArea.content = toolBarArea.createChild("div", {class: "rel"});

        // Store them as required
        this.toolBarArea = toolBarArea;
        this.hideableElements = {sideScreen, topPanel, sidePanel, bottomPanel, toolBarArea};
        this.panels = {side: sidePanel, top: topPanel, bottom: bottomPanel, tools: toolBarArea};
        this.sideScreen = sideScreen;

        this._registerWindowEventListeners();
       
    }


   _registerWindowEventListeners(){
        let oldMove = new Set();
        window.addEventListener("mousemove", (e) => {
            let move = new Set(this.getElementsAtPoints(new Vector(e)));
            move.forEach(el => el.dispatchEvent(copyEvent(e)))
            
            let leave = new MouseEvent("mouseleave");
            for (let el of oldMove) {
                if (!(move.has(el))) {
                    el.dispatchEvent(copyEvent(leave))
                }
            }
            oldMove = move;
        })

        window.addEventListener("mouseout", (e) => {
            let leave = new MouseEvent("mouseleave");
            for (let el of oldMove) {
                el.dispatchEvent(copyEvent(leave))
            }
            oldMove = new Set();
        })


        let lastTouch = [];
        window.addEventListener("touchstart", (e) => {
            let {touches} = e;
            let points = [...touches].map(t => new Vector(t.clientX, t.clientY));
            let elements = this.getElementsAtPoints(points);
            elements.forEach(el => el.dispatchEvent(copyEvent(e)));
            lastTouch = elements
        });
        window.addEventListener("touchmove", (e) => {
            let {touches} = e;
            let points = [...touches].map(t => new Vector(t.clientX, t.clientY));
            let elements = this.getElementsAtPoints(points);
            elements.forEach(el => el.dispatchEvent(copyEvent(e)));
            lastTouch = elements
        })
        window.addEventListener("touchend", (e) => {
            for (let el of lastTouch) {
                el.dispatchEvent(copyEvent(e));
            }
            lastTouch = [];
        })

    }


    getElementsAtPoints(points) {
        if (points instanceof Vector) points = [points];

        let elements = [...Object.values(this.panels).map(p => p.content.children[0]), ...this.screenAreas.keys()].filter((a) => a instanceof Element)
        
        return elements.filter(el => {
            let [pos, size] = el.bbox;
            let c = pos.add(size);

            let inside = points.map(p => p.x > pos.x && p.x < c.x && p.y > pos.y && p.y < c.y);
            inside = inside.reduce((a, b) => a || b)

            return inside;
        })
    }

    /** setPanelContent can be used to the content of a panel 
     * @param {("top"|"bottom"|"side"|"tools")} name
     * @param {ShadowElement} content
     */
    setPanelContent(name, content) {
        if ((name in this.panels)) {
            let panel = this.panels[name]
            panel.content.innerHTML = "";
            if (SvgPlus.is(content, ShadowElement)) {
                
                panel.content.appendChild(content);
            }
        }
    }

    /** addScreenArea is used to create a screen partion and insert 
     * the provided element inside 
     * @param {ScreenAreaName} areaName must be in ScreenAreaNames
     * @param {ShadowElement} content
     */
    addScreenArea(areaName, content) {
        let area = null;
        if (areaName in ScreenAreaNames && SvgPlus.is(content, ShadowElement)) {
            area = this.root.createChild(ScreenAreaNames[areaName]);
            let rel = area.createChild("div", {class: "rel"});
            area.content = rel;
            rel.appendChild(content)
            this.screenAreas.set(content, area);
        }
        return area;
    }

    /** addScreenArea removes a screen partition assosiated with the
     * provided content
     * @param {ShadowElement} content
     */
    removeScreenArea(content) {
        if (this.screenAreas.has(content)) {
            let value = this.screenAreas.get(content);
            this.screenAreas.delete(content);
            value.remove();
        }
    }

    /** addSideScreenPaenl creates a new side screen panel
     * with the provided title and content
     * 
     * @param {string} title
     * @param {ShadowElement} content
     */
    async addSideScreenPanel(title, content) {
        if (SvgPlus.is(content, ShadowElement)) {
            await this.sideScreen.add(title, content);
        }
    }

    /** removeSideScreenPanel removes a side screen panel assosiated 
     * with the provided content
     * @param {ShadowElement} content
     */
    async removeSideScreenPanel(content) {
        
        if (this.sideScreen.length == 1) {
            await this.hide("sideScreen");
        } else {
        }
        await this.sideScreen.delete(content);
    }

    /** isShown returns true if the hideable element of the 
     * given name is shown otherwise false. If the name is not valid
     * then null is returned
     * @param {string} name
     * 
     * @return {boolean?}
     */
    isShown(name) {
        if (name in this.hideableElements) {
            let el = this.hideableElements[name];
            return !!el.shown;
        } else {
            return null;
        }
    }

    async toggle(name) {
        let shown = this.isShown(name);
        await this.show(name, !shown)
    }

    /** 
     * @param {HideableElement} name 
     * @param {boolean} bool 
     * */
    async show(name, bool = true){
        if (name in this.hideableElements) {
            let el = this.hideableElements[name];
            
            if (!(name in this.transitionObjects)) {
                let cssParam = "--" + el.tagName.toLowerCase() + "-extension-p";
                let tObj = new WaveStateVariable(0, 0.5, (t) => {
                    this.root.styles = {[cssParam]: t.toPrecision(2)}
                    el.isVisible = t > 0;
                })
                this.transitionObjects[name] = tObj;
            }
            el.shown = bool;
            await this.transitionObjects[name].set(bool);
        }
    }
    
    async hide(name) {
        await this.show(name, false);
    }

    static get usedStyleSheets() {
        return [relURL("session-view.css", import.meta)];
    }
}