import { SvgPlus } from "../SvgPlus/4.js";
import { HideShow, HideShowTransition } from "./hide-show.js";
import { relURL } from "./usefull-funcs.js";


class RotaterFrame extends HideShowTransition {
    constructor(){
        super("div");

        // Setup initial state
        // 0deg angle and not flipped (shown state)
        this.angle = 0;
        this._shown = true;
        this.hiddenStyle = {
            "display": null,
        }
        this.styles = {
            ...this.hiddenStyle,
            "transform": `rotateY(${this.angle}deg)`,
            "opacity": 1,
        }
    }

    async flip(duration = 800, direction = 1){
        direction = direction >= 0 ? 1 : -1;
        let start = this.angle;
        let end = this.angle + direction * 180;
        this.angle = end;

        // Disable pointer events during animation
        this.styles = {
            "pointer-events": "none"
        }

        // Create animation sequence and reverse if currently shown
        this.animationSequence = [
            {"transform": `rotateY(${start}deg)`},
            {"transform": `rotateY(${end}deg)`},
        ];
        if (this.shown) this.animationSequence .reverse();

        // Toggle shown state to start the animation
        await this.toggle(!this.shown, duration);

        // Re-enable pointer events after animation
        this.styles = {
            "pointer-events": null
        }
    }

    get flipped(){
        let isFlipped = Math.floor(this.angle / 180) % 2 ==! 0;
        return isFlipped;
    }

}

class SlotTransition extends SvgPlus {
    constructor() {
        super("div");
        this.contentSets = []
        this.transitionTime = 0.68;
    }

    async setContent(...args) {
        if (this._settingContent) {
            this.contentSets.push(args);
        } else {
            this._settingContent = true;
            await this.applyTransition(...args);
            this._settingContent = false;
            if (this.contentSets.length > 0) {
                this.setContent(...this.contentSets.pop());
                this.contentSets = [];
            }
        }
    }

    async applyTransition() {}
}

/** Rotates between two elements */
export class Rotater extends SlotTransition {
    constructor(){
        super("div");
        this.class = "rotater";
        this.flipper = this.createChild(RotaterFrame);
        this.slot1 = this.flipper.createChild("div", {class: "slot-1"});
        this.slot2 = this.flipper.createChild("div", {class: "slot-2"});
    }

    /** Set the content of the rotater
     * @param {Element} content
     * @param {boolean} immediate whether to use rotation transition or immediate.
     * @returns {Promise<void>}
     */
    async applyTransition(content, immediate = false) {
        let element = immediate ? this.shownSlot : this.hiddenSlot;
        element.innerHTML = "";
        if (content instanceof Element) {
            element.appendChild(content);
        }

        if (!immediate) {
            let lastShown = this.shownSlot;
            await this.flipper.flip(this.transitionTime * 1000);
            lastShown.innerHTML = "";
        }
    }

    get flipped(){return !this.flipper.flipped;}
    get shownSlot(){ return this.flipped ? this.slot1 : this.slot2; }
    get hiddenSlot(){ return this.flipped ? this.slot2 : this.slot1; }


    static get styleSheet(){
        return [relURL("./rotater.css", import.meta)];
    }
}



export class Slider extends SlotTransition {
    constructor(){
        super("div");
        this.class = "slider";
        this.slot1 = this.createChild(HideShowTransition, {class: "slot-1"}, "div", "up");
        this.slot2 = this.createChild(HideShowTransition, {class: "slot-2"}, "div", "up");
        this.slot1.shown = true;
    }

    async applyTransition(content, direction = 1) {
        let immediate = !(direction === 1 || direction === -1);
       
        let element = immediate ? this.shownSlot : this.hiddenSlot;
        
        element.innerHTML = "";
        if (content instanceof Element) {
            element.appendChild(content);
        }

        if (!immediate) {
            await this.slide(direction > 0);
        }
    }


    async slide(direction = false){
        this.shownSlot.animationSequence = direction ? "down" : "up";
        this.hiddenSlot.animationSequence = direction ? "up" : "down";
        await Promise.all([
            this.slot1.toggle(!this.slot1.shown, this.transitionTime * 1000),
            this.slot2.toggle(!this.slot2.shown, this.transitionTime * 1000)
        ]);
    }

    get shownSlot(){
        return this.slot1.shown ? this.slot1 : this.slot2;
    }
    get hiddenSlot() {
        return this.slot1.shown ? this.slot2 : this.slot1;
    }

    static get styleSheet(){
        return [relURL("./rotater.css", import.meta)];
    }
}