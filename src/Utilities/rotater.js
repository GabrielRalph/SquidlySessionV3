import { SvgPlus } from "../SvgPlus/4.js";
import { relURL } from "./usefull-funcs.js";


/** Rotates between two elements */
export class Rotater extends SvgPlus {
    angle = 0;
    contentSets = [];
    constructor(){
        super("div");
        this.class = "rotater";
        let rel = this.createChild("div")
        this.slot1 = rel.createChild("div", {class: "slot-1"});
        this.slot2 = rel.createChild("div", {class: "slot-2"});
        this.transitionTime = 0.8;

    }

    /** Set the content of the rotater
     * @param {Element} content
     * @param {boolean} immediate whether to use rotation transition or immediate.
     * @returns {Promise<void>}
     */
    async setContent(content, immediate = false) {
        // If a current set is in progress add the set request to a buffer.
        if (this._settingContent) {
            this.contentSets.push([content, immediate]);
        
        // Otherwise set the content
        } else {
            this._settingContent = true;
            let element = immediate ? this.shownSlot : this.hiddenSlot;
            
            element.innerHTML = "";
            if (content instanceof Element) {
                element.appendChild(content);
            }
    
            if (!immediate) {
                await this.flip();
            }
            
            this._settingContent = false;
            if (this.contentSets.length > 0) {
                this.setContent(...this.contentSets.pop());
                this.contentSets = [];
            }
        }
    }

    
    set transitionTime(time){
        this._transitionTime = time;
        this.styles = {"--transition-time": time + "s"}
    }
    get transitionTime(){ return this._transitionTime; }
    
    get shownSlot(){ return this.flipped > 0.5 ? this.slot1 : this.slot2; }
    get hiddenSlot(){ return this.flipped > 0.5 ? this.slot2 : this.slot1; }


    /** Filps the rotater
     * @return {Promise<void>}
     */
    async flip(){
        this.flipping = true;
        this.angle =  this.angle + 180;
        this.styles = {
            "--angle": this.angle + "deg"
        }
        let flipped = !this.flipped;
        this.toggleAttribute("flip", flipped);
        this._flipped = flipped;
        await new Promise((r) => {setTimeout(r, this.transitionTime * 1000)});
        this.flipping = false;
    }


    get flipped(){return this._flipped;}

    static get styleSheet(){
        return [relURL("./rotater.css", import.meta)];
    }
}

export class Slider extends SvgPlus {
    contentSets = []
    constructor(){
        super("div");
        this.class = "slider";
        this.slot1 = this.createChild("div", {class: "slot-1"});
        this.slot2 = this.createChild("div", {class: "slot-2", styles: {"--t": 1}});
        this.transitionTime = 0.8;
        this.toggleAttribute("y", true);
        this._shownSlot = 1;
    }

    async setContent(content, direction = 1) {
        let immediate = !(direction === 1 || direction === -1);
        // If a current set is in progress add the set request to a buffer.
        if (this._settingContent) {
            this.contentSets.push([content, direction]);
        
        // Otherwise set the content
        } else {
            this._settingContent = true;
            let element = immediate ? this.shownSlot : this.hiddenSlot;
            
            element.innerHTML = "";
            if (content instanceof Element) {
                element.appendChild(content);
            }
    
            if (!immediate) {
                await this.slide(direction);
            }
            
            this._settingContent = false;
            if (this.contentSets.length > 0) {
                this.setContent(...this.contentSets.pop());
                this.contentSets = [];
            }
        }
    }


    get shownSlot(){
        return this._shownSlot === 1 ? this.slot1 : this.slot2;
    }
    get hiddenSlot() {
        return this._shownSlot === 1 ? this.slot2 : this.slot1;
    }

    async slide(direction = false){
        let {shownSlot, hiddenSlot} = this;
        await this.waveTransition((t) => {
            shownSlot.style.setProperty("--t", -1 * direction * t);
            hiddenSlot.style.setProperty("--t", direction * (1 - t));
        }, this.transitionTime * 1000, true);
        this._shownSlot = this._shownSlot === 1 ? 2 : 1;
    }

    static get styleSheet(){
        return [relURL("./rotater.css", import.meta)];
    }
}