import { HideShowTransition } from "./hide-show.js";

export class ConstantAspectRatio extends HideShowTransition {
    constructor(el = "div", startWatch = true) {
      super(el);
      this.toggleAttribute("constant-aspect")
      this.aspectRatio = 1;
      if (startWatch) this.watch
    }
  
    parseAspectRatio(value) {
      let error = null;
      if (typeof value !== "number") error = `The aspect ratio '${value}' is not a number.`;
      if (Number.isNaN(value)) error = "The aspect ratio was set to a NaN value.";
      if (value < 1e-5) error = `The aspect ratio ${value} is to small.`;
      if (value > 1e5) value = `The aspect ratio ${value} is to big.`;
  
      return error;
    }
  
  
    set aspectRatio(value) {
      let error = this.parseAspectRatio(value);
      if (error !== null) throw new Error(error);
      this._aspect_ratio = value;
      this.styles = {"--aspect": value}
    }
  
    get aspectRatio(){
      try {
        return this.getAspectRatio();
      } catch (e) {
        // console.log("error at ConstantAspectRatio getAspectRatio", e);
        return 1;
      }
    }
  
  
    getAspectRatio() {
      return this._aspect_ratio;
    }
  
    getParentSize(){
      let op = this.offsetParent;
      let size = null;
      if (op instanceof Element) {
        let bbox = op.getBoundingClientRect();
        size = new Vector(bbox.width, bbox.height);
      } else {
        size = this.bbox[1];
      }
      return size;
    }
  
    get parentSize(){
      try {
        return this.getParentSize();
      } catch (e) {
        return this.bbox[1];
      }
    }
  
    // update to use ResizeObserver
    async watchAspectRatio() {
      this.watchingAspectRatio = true;
      while (this.watchingAspectRatio) {
        let dar = this.aspectRatio;
        if (dar != null) {
          let size = this.parentSize;
          let opar = size.x / size.y;
          
          let opars = opar.toPrecision(7);
          if (opars !== this.lastParentAspect) {
            const event = new Event("aspect-ratio", {bubbles: true})
            event.aspectRatio = opars;
            this.dispatchEvent(event);
          }
          this.lastParentAspect = opars;
          this.props = {
            "orientation": opar > dar ? "landscape" : "portrait",
            styles: {
              "--parent-width": size.x + "px",
              "--parent-height": size.y + "px",
            }
          }
        }
        await delay();
      }
    }
  }
  