import { SvgPlus, Vector } from "../SvgPlus/4.js";

export class AccessEvent extends Event {
    /** @type {?("click"|"dwell"|"switch")} */
    clickMode = null;

    /** @type {?AccessClickEvent} oldEvent  */ 
    initialEvent = null

    /** @type {Promise[]} */
    eventPromises = [];

     /** 
     * @param {?("click"|"dwell"|"switch"|AccessClickEvent)} mode
     * @param {Event} oldEvent
     * */
     constructor(eventName, mode) {
        super(eventName, {cancelable: true});
        let oldEvent = this;
        if (mode instanceof AccessClickEvent) {
            if (mode.initialEvent instanceof AccessClickEvent) {
                mode = mode.initialEvent;
            }
            oldEvent = mode;
            mode = mode.clickMode;
        }
        this.clickMode = mode;
        this.initialEvent = oldEvent;
    }

    async waitFor(promise, stopImmediatePropagation = false) {
        if (stopImmediatePropagation) {
            this.stopImmediatePropagation()
        }
        
        let e = this.initialEvent;

        e.eventPromises.push(promise);

        await promise;
    }

    async waitAll(){
        return await Promise.all(this.initialEvent.eventPromises);
    }
}

export class AccessClickEvent extends AccessEvent {
    constructor(mode) {
        super("access-click", mode)
    }
}

class AccessButtonsLookupTable {
    /** @type {Object.<string, AccessButtonRoot[]>} */
    lookup = {}

    /** Add access button element to button groups lookup table.
     * @param {AccessButtonRoot} element
     * @param {string} group
     */ 
    add(element, group) {
        let {lookup} = this;
        if (typeof group === "undefined") group = element.group;
        if (!(group in lookup)) lookup[group] = [];
        if (lookup[group].indexOf(element) == -1) lookup[group].push(element);
    }

    /** Remove access button from button groups lookup table.
     * @param {AccessButtonRoot} element
     * @param {string} group
     */ 
    remove(element, group){
        let {lookup} = this;
        if (typeof group === "undefined") group = element.group;
        if (group in lookup) {
            lookup[group] = lookup[group].filter(el => el !== this);
        }
    }

    /** Get all groups of vissibl
     * @return {Object.<string,AccessButtonRoot[]>}
     */
    getVisibleGroups(){
        let newGroups = {};
        let {lookup} = this;
        for (let name in lookup) {
            let group = lookup[name].filter(button => button.isConnected && button.isVisible);
            if (group.length > 0) {
                group.sort((a, b) => {
                    if (a.order != null && b.order == null) return -1;
                    if (a.order == null && b.order != null) return 1;
                    if (a.order == null && b.order == null) return 0;
                    if (a.order != null && b.order != null) {
                        return a.order - b.order;
                    }
                });
                newGroups[name] = [...group];
            }
        }
        return newGroups;
    }
}

function checkClickable(root, element, center){
    let clickable = false;
    try {
        let els = root.elementsFromPoint(center.x, center.y);
        while (els[0].hasAttribute("access-transparent")) els.shift();
        let el = els[0]
        do {
            if (el === element) {
                clickable = true;
                break;
            }
        } while (el = (el.parentNode || el.host));
    } catch (e) {
        clickable = false;
    }
    return clickable
}

// Private variables
const $ = new WeakMap();
const ButtonsLookup = new AccessButtonsLookupTable();
class AccessButtonRoot extends HTMLElement {
    constructor(){
        super();
        $.set(this, {group: "default", order: null, highlighted: false, clickBoxElement: null});
        this.addEventListener("click", (e) => {
            this.accessClick("click", e);
        })
    }

    static get observedAttributes() {return  ["access-group", "access-order"]};

    /** @return {string} */
    get group(){ return $.get(this).group; }

    /** @param {string} group */
    set group(group){ this.setAttribute("access-group", group); }

    /** @return {?number} */
    get order(){ return $.get(this).order; }

    /** @param {number|string} order */
    set order(order){ this.setAttribute("access-order", order); }

    /** @return {boolean} */
    get isVisible() {return this.getIsVisible()}

    /** @return {Vector} */
    get center(){ return this.getCenter(); }

    /** @return {?(ShadowRoot|Document)} */
    get hostedRoot() {
        let root = this.clickBoxElement;
        while (!(root instanceof ShadowRoot) && !(root instanceof Document)) {
            let nroot = root.parentNode;
            if (nroot == null) {
                return root;
            } else {
                root = nroot;
            }
        }
        return root;
    }

    /** @param {boolean}  */
    set highlight(isHighlighted) {
        $.get(this).highlighted = isHighlighted;
        this.setHighlight(isHighlighted);
    }

    /** @returns {boolean} */
    get highlight(){
        return $.get(this).highlighted;
    }

    /** @param {Element} element */
    set clickBoxElement(element) {
        if (element instanceof Element) {
            $.get(this).clickBoxElement = element;
        }
    }

    /** @return {Element} */
    get clickBoxElement(){
        return ($.get(this).clickBoxElement || this);
    }

    /** 
     * @param {?("click"|"dwell"|"switch")} mode
     * @param {Event} oldEvent
     * */
    async accessClick(mode) {
        const event = new AccessClickEvent(mode)
        this.dispatchEvent(event);
        await Promise.all(event.eventPromises);
    }

    /** 
     * @override
     * @return {boolean} 
     * */
    getIsVisible(){return this.isPointInElement(this.center);}

    /**
     * @override
     * @return {Vector} 
     * */
    getCenter(){ 
        let brect = this.getBoundingClientRect();
        let center = new Vector(brect.x + brect.width/2, brect.y + brect.height/2)
        return center;
    }

    /**
     * @override
     * @param {boolean} isHighlighted whether the element is being highlighted
     */
    setHighlight(isHighlighted){
        this.toggleAttribute("hover", isHighlighted)
    }


    /**
     * @override
     * @param {Vector} p point to check
     * 
     * @return {boolean} whether the point is in the element.
     */
    isPointInElement(p) {
        let root = this.hostedRoot;
        let proxy = this.clickBoxElement;
        return checkClickable(root, proxy, p)
    }


    connectedCallback() {
        ButtonsLookup.add(this);
        
    }
    
    disconnectedCallback() {
        ButtonsLookup.remove(this);
        if (this.ondisconnect instanceof Function) this.ondisconnect();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "access-group") {
            // Store newValue in private storage.
            $.get(this).group = newValue;

            // Update the lookup table if the icon is already connected.
            if (this.isConnected) {
                ButtonsLookup.remove(this, oldValue);

                ButtonsLookup.add(this, newValue);
            }
        } else if (name === "access-order") {
            let order = parseFloat(newValue);
            if (Number.isNaN(order)) order = null;
            $.get(this).order = order;
        }
    }
}
customElements.define("access-button", AccessButtonRoot);




/**
 * @extends {AccessButtonRoot}
 */
export class AccessButton extends SvgPlus {
    constructor(group) {
        super("access-button");
        this.group = group;
    }
}

export function getButtonGroups(){
   return ButtonsLookup.getVisibleGroups();
}

window.getButtonGroups = getButtonGroups;