import {SvgPlus} from "../SvgPlus/4.js"
import {delay, isPageHidden, WaveStateVariable} from "./usefull-funcs.js"


/**
 * Old hide show class using wave state variable for smoother transitions
 * @deprecated
 */
export class HideShow extends SvgPlus {
  constructor(el = "div") {
    super(el);
    this.transState = new WaveStateVariable(false, 0.400, (t) => {
      
      this.setTransitionVariable(t);
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

  setTransitionVariable(state) { 
    this.opacity = state;
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



const WAVE_CUBIC = "cubic-bezier(0.32, 0.00, 0.68, 1)"
function setupAnimation(start, end) {
    return [start, end]
}
const TRANSITION_SEQUENCES = {
    fade: setupAnimation({opacity: 0}, {opacity: 1}),
    up: setupAnimation({transform: "translate(0, 100%)",}, {transform: "translate(0, 0)"}),
    down: setupAnimation({transform: "translate(0, -100%)",}, {transform: "translate(0, 0)"}),
    left: setupAnimation({transform: "translate(100%, 0)",}, {transform: "translate(0, 0)"}),
    right: setupAnimation({transform: "translate(-100%, 0)",}, {transform: "translate(0, 0)"}),
}

/**
 * Hide show transition class using web animations for smoother transitions
 */
export class HideShowTransition extends SvgPlus {
    constructor(elementName, mode="fade") {
        super(elementName);

       this.animationSequence = mode;

        this.hiddenStyle = {
            display: "none"
        }
        this.shownStyle = {
            display: null
        }
        this.intermediateStyle = {
            display: null
        }

        // Initial shown state
        this.shown = false;
    }


    set animationSequence(value) {
      if (typeof value === "string") {
         // Determine animation sequence based on mode
        if (value in TRANSITION_SEQUENCES) {
            this._animationSequence = TRANSITION_SEQUENCES[value];
        } else {
            this._animationSequence = TRANSITION_SEQUENCES["fade"];
        }
      } else if (Array.isArray(value) && value.length == 2) {
        this._animationSequence = value;
      }
    }

    get animationSequence() {
      return this._animationSequence;
    }


    /** Toggle to the desired shown state animating over time
     * @param {boolean} isShow
     * @param {number} time
     * @return {Promise<void>}
     */
    async toggle(isShow, time) {
      // Only run if state is changing
      if (isShow !== this._shown) {
        // Update shown state immediately
        this._shown = isShow;

        // Ensure element is visible before animating
        this.styles = this.intermediateStyle;

        // If time is 0 set styles immediately otherwise animate
        let isCanceled = false;
        if (!time) {
          // Clean up existing animation
          if (this._animation) this._animation.cancel();
        } else {
          // Setup animation
          let animation = this.animate(this.animationSequence, {
            duration: time,
            iterations: 1,
            composite: "replace",
            easing: WAVE_CUBIC,
          })

          // Reverse animation if hiding
          if (!isShow) animation.reverse();

          // If there is an existing animation, sync progress
          if (this._animation) {
            let progress = this._animation.currentTime / this._animation.effect.getComputedTiming().duration;
            animation.currentTime = progress * animation.effect.getComputedTiming().duration;
            this._animation.cancel();
          }

          // Store current animation
          this._animation = animation;
          isCanceled = await new Promise((resolve) => {
            animation.onfinish = () => resolve(false)
            animation.oncancel = () => resolve(true)
          });
        }

        // Apply final styles if not canceled
        if (!isCanceled) {
          this.styles = {
            ...this.animationSequence[isShow ? 1 : 0],
            ...(isShow ? this.shownStyle : this.hiddenStyle)
          }
        }
      }
    }

    /** Immediate shown state
     * @param {boolean} value
     */
    set shown(value) {
        this.toggle(value, 0);
    }

    /** @return {boolean} */
    get shown() {return this._shown;}

    /** Toggles to shown state
     * @param {number} duration
     */
    async show(duration = 400) {
      duration = isPageHidden() ? 0 : duration;
      await this.toggle(true, duration);
    }

    /** Toggles to hidden state
     * @param {number} duration
     */
    async hide(duration = 400) {
      duration = isPageHidden() ? 0 : duration;
      await this.toggle(false, duration);
    }
}
