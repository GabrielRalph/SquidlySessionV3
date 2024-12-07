import {SvgPlus} from "../SvgPlus/4.js"
import {isPageHidden} from "./usefull-funcs.js"

class WaveTransition{
  constructor(update, duration, dir){
    let stop = false;
    let executor = (resolve) => {
      let t0;
      let end = false;

      let next = (t) => {
        let dt = t - t0;

        if (dt > duration) {
          end = true;
          dt = duration;
        }

        let theta = Math.PI * ( dt / duration  +  (dir ? 1 : 0) );
        let progress =  ( Math.cos(theta) + 1 ) / 2;

        if (update instanceof Function) update(progress);

        if (!end && !stop){
          window.requestAnimationFrame(next);
        }else{
          resolve(progress);
        }
      };
      window.requestAnimationFrame((t) => {
        t0 = t;
        window.requestAnimationFrame(next);
      });
    }
    this.prom = new Promise(executor)
    this.stop = () => {stop = true;}
  } 
  
}


export class HideShow extends SvgPlus {
    constructor(el = "div") {
      super(el);
      this.shown = false;
    }
  
    set _hideShowState(value){
      this.setAttribute("hide-show", value)
    }
  
      set opacity(o){
          this.styles = {
        "--param-t": o
      }
      }
  
      set disabled(value) {
          this.opacity = value ? 0.5 : 1;
          this._hideShowState = value ? "disabled" : "shown"
      }
  
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
  
    async show(duration = 400, hide = false) {
      if (this._shown == !hide) return;
      if (this._transitioning instanceof Promise) {
        this._transitioning.stop();
        await this._transitioning;
      }
      this._shown = !hide;
      if (!hide) {
        this.opacity = 0;
        this._hideShowState = "shown";
      }
  
      if (!isPageHidden()){
        this._transitioning = new WaveTransition((t) => {
          this.opacity = t;
        }, duration, !hide);
        await this._transitioning.prom;
      }
      this._transitioning = null;
  
      this.shown = !hide;
    }
      async hide(duration = 400) {
          await this.show(duration, true);
      }
  
    set shown(value) {
      if (value) {
              this.opacity = 1;
        this._hideShowState = "shown";
      } else {
              this.opacity = 0;
        this._hideShowState = "hidden";
      }
      this._shown = value;
    }
    get shown(){return this._shown;}
  }