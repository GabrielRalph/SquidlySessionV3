import {SvgPlus} from "../SvgPlus/4.js"
import {isPageHidden, WaveStateVariable} from "./usefull-funcs.js"

export class HideShow extends SvgPlus {
  constructor(el = "div") {
    super(el);
    this.transState = new WaveStateVariable(false, 0.400, (t) => {
      
      this.opacity = t;
      if (t == 0) {
        this.applyHiddenState();
        this._shown = false;
      } else if (t == 1) {
        this.applyShownState();
        this._shown = true;
      } else {
        this.applyIntermediateState(t);
      }
    });
  }

  applyIntermediateState(t) {
  }

  applyHiddenState() {
    this.opacity = 0;
    this.styles = {"pointer-events": "none"}
    this.toggleAttribute("hide", true)
  }

  applyShownState() {
    this.opacity = 1;
    this.styles = {"pointer-events": null}
    this.toggleAttribute("hide", false)
  }

  /** @param {boolean} value */
  shownDecedents(value) {
    let recurse = (node) => {
      for (let child of node.children) {
        if (SvgPlus.is(child, HideShow)) {
          child.shown = value;
          recurse(child);
        }
      }
    }
  }
  
  /** 
   * @param {number} duration
   * @param {boolean} hide
   */
  async show(duration = 400, hide = true) {
    if (!isPageHidden()){
      this.transState.duration = duration/1000;
      this.transState.reverseDuration = duration/1000;
      await this.transState.set(hide)
    } else {
      this.transState.hardSet(hide);
    }
  }

  /** @param {number} duration */
  async hide(duration = 400) {
      await this.show(duration, false);
  }

    /** @param {number} o */
  set opacity(o){
    this.styles = {
      "opacity": o
    }
  }
  
  /** @param {boolean} value */
  set disabled(value) {
      this.opacity = value ? 0.5 : 1;
      this.toggleAttribute("disabled", value)
  }
  
  /** @param {boolean} value*/
  set shown(value) {
    this.transState.hardSet(value);
  }

  /** @return {boolean}*/
  get shown(){return this._shown;}
}