import {SvgPlus} from "../SvgPlus/4.js"

export class Slider extends SvgPlus {
    constructor(){
        super("slider-input");
        
        this.props = {
            styles: {
                display: "flex",
                width: "100%",
                height: "100%",
                cursor: "pointer",
            },
        };
  
        this.click_box = this.createChild("div", {
          styles: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "none",
          }
        })
  
        let svg = this.createChild("svg", {
          viewBox: "0 3 40 4",
          styles: {
            "padding": 0,
          }
        })
        svg.createChild("path", {
            d: "M2,5L38,5",
            stroke: "gray",
            fill: "none",
            "stroke-linecap": "round",
            "stroke-width": 1,
            events: {
                click: (e) => this.selectAt(e)
            }
        })
        this.circle = svg.createChild("circle", {
            cy: 5
        })
        this.r = 1.5;
        this.cx = 2;
  
        this.addEventListener("mousedown", (e) => {
            this.mode = "grab"
            this.click_box.styles = {"display": null}
            e.preventDefault();
        })
        this.addEventListener("mousemove", (e) => {
            this.mode = e.buttons == 1 ? "grab" : "over";
            if (e.buttons) {
              this.moveCursor(e);
              e.preventDefault();
            }
        })
  
        this.addEventListener("mouseup", (e) => {
            this.mode = "over"
            this.click_box.styles = {"display": "none"}
  
        })
        this.addEventListener("mouseleave", (e) => {
            this.mode = null;
            this.click_box.styles = {"display": "none"}
  
        })
  
        let next = () => {
            this.draw();
            // if (this.offsetParent != null)
                window.requestAnimationFrame(next);
        }
        window.requestAnimationFrame(next);
  
    }
  
    /** @param {MouseEvent} e */
    selectAt(e){
        let [pos, size] = this.bbox;
        this.cx = 40 * (e.clientX - pos.x) / size.x;
        const event = new Event("change");
        this.dispatchEvent(event);
    }
  
    /** @param {MouseEvent} e */
    moveCursor(e) {
        let size = this.bbox[1].x;
        let dx = 40 * e.movementX / size;
        this.cx += dx;
  
        const event = new Event("change");
        this.dispatchEvent(event);
    }
  
    draw(){
        if (this.mode === "over") {
            if (this.r < 2) this.r += 0.05;
        } else if (this.mode == "grab") {
            if (this.r > 1) this.r -= 0.15;
        } 
    }
  
    /** @param {number} cx */
    set r(r){
        this.circle.props = {r}
        this._r = r;
    }
    
    /** @return {number} */
    get r(){
        return this._r;
    }
  
    /** @param {number} cx */
    set cx(cx){
        if (cx < 2) cx = 2;
        if (cx > 38) cx = 38;
        this.circle.props = {cx}
        this._x = cx
    }
  
    /** @return {number} */
    get cx(){
        return this._x;
    }
  
    set mode(mode){
        switch (mode) {
            case "grab":
                this.styles = {cursor: "grabbing"};
                break;
            case "over":
                this.styles = {cursor: "pointer"}
                break;
            default:
                this.r = 1.5;
        }
        this._mode = mode;
    }
  
    get mode(){
        return this._mode;
    }
  
  
    /** @param {number} value 0 <= value <= 1 */
    set value(value) {
        if (value < 0) value = 0;
        if (value > 1) value = 1;
        this.cx = value * 36 + 2;
    }
  
    /** @return {number} */
    get value(){
        return (this.cx - 2)/36;
    }
  }
  