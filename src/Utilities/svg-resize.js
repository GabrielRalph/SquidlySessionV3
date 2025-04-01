
import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { HideShow } from "./hide-show.js";
import { dotGrid, linspace, transition } from "./usefull-funcs.js";

export class SvgResize extends HideShow {
    constructor(){
      super("svg");
      this.styles = {width: "100%", height: "100%"}
      this.W = 0;
      this.H = 0;
      this._drawbables = [];
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
        this.draw();
      })
      this.resizeObserver.observe(this);
    }
  
    resize(){
      let bbox = this.getBoundingClientRect();
      this.props = {viewBox: `0 0 ${bbox.width} ${bbox.height}`};
      this.W = bbox.width;
      this.H = bbox.height;
    }
  
    draw(){
      for (let drawable of this._drawbables) {
        drawable.draw();
      }
    }
  
    createPointer(){
      let args = [...arguments];
      let name = args.shift();
      let pointer = null;
      if (name in POINTERS) {
        pointer = new POINTERS[name](...args);
        this.appendChild(pointer);
      }
      return pointer;
    }
  
    createGrid(gridIntrevals = 5){
      let grid = this.createChild(Grid);
      grid.gridIntrevals = gridIntrevals;
      this._drawbables.push(grid);
      return grid;
    }
  
    start(){
        let stop = false;
        this.stop();
        this.stop = () => {stop = true}
        let next = () => {
            if (!stop) {
                this.resize();
                this.draw();
                window.requestAnimationFrame(next);
            } else {
                this.stop = () => {}
            }
      }
      window.requestAnimationFrame(next);
    }

    stop(){}
  }
  
  export class BasePointer extends HideShow {
    constructor(){
      super("g")
    }
  
    set position(v) {
      if (v instanceof Vector) v = v.clone();
      try {
        this.setPosition(v);
      } catch(e) {
        v = null;
      }
  
      this._position = v;
    }
    get position(){
      let p = this._position;
      if (p instanceof Vector) p = this._position.clone();
      return p;
    }

    // set size(size){
    //   try {
    //     this.setSize(size);
    //   } catch(e) {
    //     size = 1;
    //   }
    //   this._size = size;
    // }
    // get size(){
    //   return this._size;
    // }

  
    fromRelative(v) {
      let abs = null;
      try {
        let svg = this.ownerSVGElement;
        abs = new Vector(v.x * svg.W, v.y * svg.H);
      } catch(e) {}
      return abs;
    }
  
    setPosition(v){
      v = this.fromRelative(v);
      this.translate(v, this.size);
    }

    setSize(size) {
      v = this.fromRelative(this.position);
      this.translate(v, size);
    }
  
    translate(v, scale = 1) {
      // v = v.div(scale);
      this.props = {
        transform: `translate(${v.x}, ${v.y})`,
      }
    }
  
    async moveTo(end, duration) {
      try {
        let start = this.position;
        if (!(start instanceof Vector)) start = new Vector(0);
        await transition((t) => {
          this.position = start.mul(1 - t).add(end.mul(t));
        }, duration);
      } catch (e) {}
    }
  }
  
  const POINTERS = {
    calibration: class CPointer extends BasePointer {
      constructor(size, cOuter = "red", cInner = "darkred", cText = "white") {
        super();
        this.circle = this.createChild("circle", {fill: cOuter})
        this.circle2 = this.createChild("circle", {fill: cInner})
        this.tg = new HideShow("g");
        this.circle3 = this.tg.createChild("circle", {fill: cOuter})
        this.textel = this.tg.createChild("text", {"text-anchor": "middle", fill: cText});
        this.appendChild(this.tg);
        this.size = size;
      }
  
      set color(c){
        let p = {fill: c};
        this.circle.props = p;
        this.circle3.props = p;
      }
  
      async showText(duration = 400) {await this.tg.show(duration)}
      async hideText(duration = 400) {await this.tg.hide(duration)}
  
      set text(value) {
        this.textel.innerHTML = value;
      }
      set size(size) {
        this.circle.props = {r: size};
        this.circle2.props = {r: size/5};
        this.circle3.props = {r: size/1.5};
        this.textel.props = {"font-size": size * 1.2, y: size * 0.4};
      }
    },
    simple: class SPointer extends BasePointer {
      constructor(size, color = "blue") {
        super();
        this.circle = this.createChild("circle", {fill: color})
        this.size = size;
      }
  
      setPosition(v){
        this.translate(v);
      }
  
      set size(size) {
        this.circle.props = {r: size};
      }
    },
    cursor: class MCursor extends BasePointer {
      constructor(){
        super();
        this.icon = this.createChild("g");
        // this.createChild("circle", {fill: "red", r: 2});
        this.icon.innerHTML = `<path d="M5.8,16.4l1.9-1l1.6-0.8L6.7,9.8H11L-0.4-1.6v16l3.3-3.2L5.8,16.4z"/><path d="M6,15L7.8,14L5,8.8h3.6l-8-8V12l2.5-2.4L6,15z"/>`;
        this.type = '00';
      }
  
      set type(type){
        if (typeof type === "string" && type.length > 1) {
          let b = this.icon.children[0];
          let t = this.icon.children[1];
  
          let size = 1 + parseInt(type[0]);
          this.icon.props = {transform: `scale(${size})`}
          switch(type[1]) {
            case '0': 
              b.style.setProperty("fill", "black");   
              t.style.setProperty("fill", "white"); 
            break
            case '1': 
              b.style.setProperty("fill", "white");
              t.style.setProperty("fill", "black"); 
            break
            case '2': 
              b.style.setProperty("fill", "#FFC107")
              t.style.setProperty("fill", "black"); 
            break
          }
        }
      }
      
      setPosition(v) {
        this.translate(v);
      }
    },
    blob: class BPointer extends BasePointer {
      constructor(size, bufferLength = 7){
        super();
          // svg filter to create merged blobs
          this.innerHTML = `
          <defs>
            <filter id="filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="linearRGB">
              <feGaussianBlur stdDeviation="0.5 0.5" x="-100%" y="-100%" width="200%" height="200%" in="morphology1" edgeMode="none" result="blur"/>
              <feComposite in="blur" in2="SourceGraphic" operator="xor" x="-100" y="-100" width="100%" height="100%" result="composite"/>
              <feComposite in="composite" in2="composite" operator="lighter" x="-100" y="-100" width="100%" height="100%" result="composite1"/>
            </filter>
          </defs>
          `
          this.g = this.createChild("g", {filter: "url(#filter)"});
          this.g2 = this.createChild("g", {filter: "url(#filter)"});
  
          this.positionBuffer = [];
          this.bufferLength = bufferLength;
          this.size = size;
        }
  
      addPointToBuffer(point) {
        if (point instanceof Vector) {
          this.positionBuffer.unshift(point);
          if (this.positionBuffer.length > this.bufferLength) {
            this.positionBuffer.pop();
          }
        } else {
          this.positionBuffer.pop();
        }
      }
  
      // smooth point and add it to position buffer
      setPosition(point) {
        point = this.fromRelative(point);
        this.addPointToBuffer(point);
        if (point) {
          this.translate(point);
        }
        this.render();
        return point;
      }
  
      render(){
        for (let g of [this.g, this.g2]) {
          g.innerHTML = "";
          if (this.positionBuffer.length > 0) {
            let col = this.g == g ? "black" : "white";
            let offset = col == "black" ? -1 : 0

            let size = this.size;
            let p0 = this.positionBuffer[0];
            g.createChild("circle", {r: size - offset,stroke: col});
            for (let i = 1; i < this.positionBuffer.length; i++) {
              size /= 1.35;
              let v = this.positionBuffer[i].sub(p0);
              g.createChild("circle", {r: size - offset, cx: v.x, cy: v.y, stroke: col})
            }
          }
        }
      }
    }
  }
  
  class Grid extends SvgPlus {
    constructor(gridIntrevals = 7, color = "#00000020", dotSize = 3, padding = 30) {
      super("g")
      this.gridIntrevals = gridIntrevals;
      this.color = color;
      this.padding = padding;
      this.dotSize = dotSize;
    }
    draw(){
      let s = this.padding;
      let size = this.dotSize;
      let {W, H} = this.ownerSVGElement;
      if (this.lastW != W || this.lastH != H) {
        this.innerHTML = "";
        this.lastW = W;
        this.lastH = H;
        let grid = dotGrid(this.gridIntrevals, new Vector(s), new Vector(W-s, s), new Vector(s, H-s), new Vector(W-s, H-s));
        for (let p of grid) {
          this.createChild("circle", {cx: p.x, cy: p.y, r: size, fill: this.color})
        }
      }
    }
  }
  
  export class SvgCanvas extends SvgPlus {
    constructor(el = "svg-canvas"){
      super(el);
      if (typeof el === "string") this.onconnect();
  
      let opacity = 0;
      let fader = () => {
        if (this.fade) opacity -= 0.02;
        else opacity = 1;
        if (this.msg){
          this.msg.styles = {opacity: opacity};
        }
        window.requestAnimationFrame(fader);
      }
      window.requestAnimationFrame(fader);
    }
    onconnect(){
      this.innerHTML = "";
          this.styles = {
        display: "flex",
        transform: "scale(-1, 1)"
  
      }
      let rel = this.createChild("div", {styles: {
              position: "relative",
              display: "inline-flex",
              width: "100%",
          }});
      this.video = rel.createChild("video", {autoplay: true, playinline: true, styles:{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
        width: "100%",
        height: "100%",
          }});
      this.canvas = rel.createChild("canvas", {styles: {
              width: "100%",
          }});
      this.svg = rel.createChild("svg", {styles:{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0,
          }});
      this.msg = rel.createChild("div", {class: "msg",styles:{
              position: "absolute",
              opacity: 0,
          }});
    }
  
    updateCanvas(source, clear = true) {
      let {canvas, svg} = this;
      try {
        let {width, height} = source;
        canvas.width = width;
        canvas.height = height;
        let destCtx = canvas.getContext('2d');
        destCtx.drawImage(source, 0, 0);
        svg.props = {viewBox: `0 0 ${width} ${height}`, style: {opacity: 1}}
      } catch (e) {
        svg.styles = {opacity: 0}
      }
  
          if (clear) svg.innerHTML = ""
    }
  
    set error(value) {
      let {msg, svg} = this;
      if (value != null) {
        msg.innerHTML = value;
        this.fade = false;
      } else {
        this.fade = true;
      }
      svg.toggleAttribute('valid', value == null);
    }
  
    transform(x,y,scale,angle,group) {
      let p = new Vector(x, y);
      p = p.div(scale);
      p = p.rotate(-angle);
          let transform = `rotate(${angle*180/Math.PI}) scale(${s}) translate(${p.x}, ${p.y})`
      if (group) group.setAttribute('transform', transform);
          return transform;
    }
  }
  
  export class PopUpFrame extends SvgPlus {
    constructor(){
      super("pop-up-frame");
      this.styles = {
        position: "fixed",
        display: "block",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        "pointer-events": "none",
      };
      this.popup = new FloatingBox("pop-up");
      this.appendChild(this.popup);
      this.popup.styles = {position: 'fixed', display: 'inline-block'};
      this.align = "center";
    }
  
    set align(name){
      this.popup.align = name;
    }
  
    async showMessage(message, time){
      let {popup} = this;
      popup.innerHTML = "";
      popup.createChild("div", {class: "msg", content: message});
      await this.show();
      if (time) {
        await delay(time);
        await this.hide();
      }
    }
  
    async prompt(message, responses){
      if (typeof responses === "string") responses = [responses];
      let {popup} = this;
      popup.innerHTML = "";
      popup.createChild("div", {class: "msg", content: message});
      let btns = popup.createChild("div", {class: "btn-box"});
      for (let response of responses) {
        let btn = btns.createChild("div", {class: "btn", content: response})
        btn.response = response;
      }
      await this.show();
      let response = await new Promise((resolve, reject) => {
        for (let btn of btns.children) {
          btn.onclick = () => resolve(btn.response);
        }
      });
      this.hide();
      return response;
    }
  }