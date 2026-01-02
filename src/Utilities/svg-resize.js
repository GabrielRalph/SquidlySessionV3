
import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { HideShow, HideShowTransition } from "./hide-show.js";
import { dotGrid, transition } from "./usefull-funcs.js";

export class SvgResize extends HideShowTransition {
  constructor() {
    super("svg");
    this.styles = { width: "100%", height: "100%" }
    this.W = 0;
    this.H = 0;
    this._drawbables = [];
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.draw();
    })
    this.resizeObserver.observe(this);
  }

  resize() {
    let {clientWidth, clientHeight} = this;
    this.props = { viewBox: `0 0 ${clientWidth} ${clientHeight}` };
    this.W = clientWidth;
    this.H = clientHeight
  }

  addDrawable(drawable) {
    if (typeof drawable === "object" && drawable != null && "draw" in drawable && drawable.draw instanceof Function) {
      this._drawbables.push(drawable);
    }
  }

  draw() {
    for (let drawable of this._drawbables) {
      drawable.draw();
    }
  }

  createPointer() {
    let args = [...arguments];
    let name = args.shift();
    let pointer = null;
    if (name in POINTERS) {
      pointer = new POINTERS[name](...args);
      this.appendChild(pointer);
    }
    return pointer;
  }

  createGrid(gridIntrevals = 5) {
    let grid = this.createChild(Grid);
    grid.gridIntrevals = gridIntrevals;
    this._drawbables.push(grid);
    return grid;
  }

  start() {
    let stop = false;
    this.stop();
    this.stop = () => { stop = true }
    let next = () => {
      if (!stop) {
        this.resize();
        this.draw();
        window.requestAnimationFrame(next);
      } else {
        this.stop = () => { }
      }
    }
    window.requestAnimationFrame(next);
  }

  stop() { }
}

const CURSOR_PATHS = {
  a: `<path d="M11,32l3.8-2,3.2-1.6-5.2-9.6h8.6L-1.4-4v32l6.6-6.4,5.8,10.4Z"/>
  <path d="M11.4,29.2l3.6-2-5.6-10.4h7.2L.6.8v22.4l5-4.8,5.8,10.8Z"/>`,
  r: `<path d="M120.93,12.31l-241.85-.17c-2.25,0-4.07-1.83-4.07-4.07s1.83-4.07,4.07-4.07l115.57.17L0-2.69l5.36,6.85h115.57c2.25,0,4.07,1.83,4.07,4.07s-1.83,4.07-4.07,4.07ZM-120.93,5.87c-1.21,0-2.19.98-2.19,2.19s.98,2.19,2.19,2.19l241.85.17c1.21,0,2.19-.98,2.19-2.19s-.98-2.19-2.19-2.19H4.44L0,.36l-4.44,5.68-116.49-.17Z"/>
  <path d="M4.44,6.04L0,.36l-4.44,5.68-116.49-.17c-1.21,0-2.19.98-2.19,2.19s.98,2.19,2.19,2.19l241.85.17c1.21,0,2.19-.98,2.19-2.19s-.98-2.19-2.19-2.19H4.44Z"/>`,
  c: `<path d="M0,21.71c-22.06,0-40-17.94-40-40S-22.06-58.29,0-58.29s40,17.94,40,40S22.06,21.71,0,21.71ZM0-55.2c-20.36,0-36.91,16.56-36.91,36.91S-20.36,18.62,0,18.62,36.91,2.06,36.91-18.3,20.36-55.2,0-55.2Z"/>
  <path d="M0-55.2c-20.36,0-36.91,16.56-36.91,36.91S-20.36,18.62,0,18.62,36.91,2.06,36.91-18.3,20.36-55.2,0-55.2ZM1.4,15.47C1.16,12.87,0,0,0,0l-1.4,15.47c-17.53-.72-31.64-14.82-32.36-32.36l15.47-1.4s-12.87-1.16-15.47-1.4c.72-17.53,14.82-31.64,32.36-32.36l1.4,15.47s1.16-12.87,1.4-15.47c17.53.72,31.64,14.82,32.36,32.36-2.6.24-15.47,1.4-15.47,1.4l15.47,1.4C33.04.64,18.93,14.75,1.4,15.47Z"/>`
}
export class BasePointer extends HideShow {
  constructor() {
    super("g")
  }

  set position(v) {
    if (v instanceof Vector) v = v.clone();
    try {
      this.setPosition(v);
    } catch (e) {
      v = null;
    }

    this._position = v;
  }
  get position() {
    let p = this._position;
    if (p instanceof Vector) p = this._position.clone();
    return p;
  }

  fromRelative(v) {
    let abs = null;
    try {
      let svg = this.ownerSVGElement;
      abs = new Vector(v.x * svg.W, v.y * svg.H);
    } catch (e) { }
    return abs;
  }

  setPosition(v) {
    v = this.fromRelative(v);
    this.translate(v, this.size);
  }

  translate(v) {
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
    } catch (e) { }
  }
}

export const POINTERS = {
  calibration: class CPointer extends BasePointer {
    constructor(size, cOuter = "red", cInner = "darkred", cText = "white") {
      super();
      let sizeG = this.createChild("g");
      let subG = sizeG.createChild("g", { transform: "translate(-50, -50)" });
      this.circle = subG.createChild("circle", { r: 50, fill: cOuter, cx: 50, cy: 50 })
      this.circle2 = subG.createChild("circle", { r: 10, cx: 50, cy: 50, fill: cInner })

      this.sizeG = sizeG;
      this.subG = subG;
      this.size = size;
    }

    async showText(duration = 400) { await this.tg.show(duration) }
    async hideText(duration = 400) { await this.tg.hide(duration) }

    set size(size) {
      this.sizeG.props = { transform: `scale(${size / 50})` }
    }

    /**
     * @param {string} value - svg path data for guide
     */
    set guide(value) {
      this.subG.innerHTML = value;
    }
  },
  simple: class SPointer extends BasePointer {
    constructor(size, color = "blue") {
      super();
      this.circle = this.createChild("circle", { fill: color })
      this.size = size;
    }

    setPosition(v) {
      this.translate(v);
    }

    /**
     * @param {number} size
     */
    set size(size) {
      this.circle.props = { r: size };
    }
  },
  cursor: class MCursor extends BasePointer {
    constructor() {
      super();
      this.icon = this.createChild("g");
      // this.createChild("circle", {fill: "red", r: 2});
      this.icon.innerHTML = CURSOR_PATHS.a;
      this.cpathName = 'a';
      this.type = '00a';
    }

    /**
     * @param {string} type cursor color type
     *                      [size = 0-3][color = 0-4]
     */
    set type(type) {
      if (typeof type === "string" && type.length > 1) {
        if (type.length >= 3) {
          let pathType = type[2];
          if (pathType != this.cpathName && pathType in CURSOR_PATHS) {
            this.cpathName = pathType;
            this.icon.innerHTML = CURSOR_PATHS[this.cpathName];
          }
        }

        let b = this.icon.children[0];
        let t = this.icon.children[1];

        let size = 1 + parseInt(type[0]);
        this.icon.props = { transform: `scale(${size})` }
        switch (type[1]) {
          case '0':
            b.style.setProperty("fill", "black");
            t.style.setProperty("fill", "white");
            break
          case '1':
            b.style.setProperty("fill", "white");
            t.style.setProperty("fill", "black");
            break
          case '2':
            t.style.setProperty("fill", "#FFC107")
            b.style.setProperty("fill", "black");
            break
          case '3': 
            t.style.setProperty("fill", "#8aff03")
            b.style.setProperty("fill", "black");
            break
          case '4': 
            t.style.setProperty("fill", "#FFC107")
            b.style.setProperty("fill", "#0606f7");
            break
        }

        
      } else {
        this.styles = { display: "none" };
      }
    }

    setPosition(v) {
      v = this.fromRelative(v);
      this.translate(v);
    }
  },
  blob: class BPointer extends BasePointer {
    constructor(size, bufferLength = 7) {
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
      this.g = this.createChild("g", { filter: "url(#filter)" });
      this.g2 = this.createChild("g", { filter: "url(#filter)" });
      this.g3 = this.createChild("g");

      this.positionBuffer = [];
      this.bufferLength = bufferLength;
      this.size = size;
      this.text = "hello worlds"

    }

    /**
     * @param {string} text
     */
    set text(text) {

      this.g3.innerHTML = "";

      if (typeof text === "string" && text.length > 0) {
        let fs = 16;
        let r = (this.size + fs) / Math.sqrt(2);
        let h = fs * (10 / 7);


        let w = text == "host" ? 54 : 98;
        this.g3.createChild("rect", {
          rx: h / 2,
          ry: h / 2,
          x: r,
          y: r - h,
          width: w,
          height: h,
          "fill-opacity": 0.8
        })

        this.g3.createChild("text", {
          x: r + w / 2, y: r - fs * 0.33,
          "text-anchor": "middle",
          content: text,
          fill: "white",
          "font-size": fs,
        })
      } else {
        text = null;
      }
      this._text = text;
    }
    get text() {
      return this._text;
    }

    /**
     * @param {number} size
     */
    set size(size) {
      this.text = this.text;
      this._size = size;
    }
    get size() {
      return this._size;
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

    render() {
      for (let g of [this.g, this.g2]) {
        g.innerHTML = "";
        if (this.positionBuffer.length > 0) {
          let col = this.g == g ? "black" : "white";
          let offset = col == "black" ? -1 : 0

          let size = this.size;
          let p0 = this.positionBuffer[0];
          let c0 = g.createChild("circle", { r: size - offset, stroke: col });
          for (let i = 1; i < this.positionBuffer.length; i++) {
            size /= 1.35;
            let v = this.positionBuffer[i].sub(p0);
            g.createChild("circle", { r: size - offset, cx: v.x, cy: v.y, stroke: col })
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
  draw() {
    let s = this.padding;
    let size = this.dotSize;
    let { W, H } = this.ownerSVGElement;
    if (this.lastW != W || this.lastH != H) {
      this.innerHTML = "";
      this.lastW = W;
      this.lastH = H;
      let grid = dotGrid(this.gridIntrevals, new Vector(s), new Vector(W - s, s), new Vector(s, H - s), new Vector(W - s, H - s));
      for (let p of grid) {
        this.createChild("circle", { cx: p.x, cy: p.y, r: size, fill: this.color })
      }
    }
  }
}

export class SvgCanvas extends SvgPlus {
  constructor(el = "svg-canvas") {
    super(el);
    if (typeof el === "string") this.onconnect();

    let opacity = 0;
    let fader = () => {
      if (this.fade) opacity -= 0.02;
      else opacity = 1;
      if (this.msg) {
        this.msg.styles = { opacity: opacity };
      }
      window.requestAnimationFrame(fader);
    }
    window.requestAnimationFrame(fader);
  }
  onconnect() {
    this.innerHTML = "";
    this.styles = {
      display: "flex",
      transform: "scale(-1, 1)"

    }
    let rel = this.createChild("div", {
      styles: {
        position: "relative",
        display: "inline-flex",
        width: "100%",
      }
    });
    this.video = rel.createChild("video", {
      autoplay: true, playinline: true, styles: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
      }
    });
    this.canvas = rel.createChild("canvas", {
      styles: {
        width: "100%",
      }
    });
    this.svg = rel.createChild("svg", {
      styles: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
      }
    });
    this.msg = rel.createChild("div", {
      class: "msg", styles: {
        position: "absolute",
        opacity: 0,
      }
    });
  }

  updateCanvas(source, clear = true) {
    let { canvas, svg } = this;
    try {
      let { width, height } = source;
      canvas.width = width;
      canvas.height = height;
      let destCtx = canvas.getContext('2d');
      destCtx.drawImage(source, 0, 0);
      svg.props = { viewBox: `0 0 ${width} ${height}`, style: { opacity: 1 } }
    } catch (e) {
      svg.styles = { opacity: 0 }
    }

    if (clear) svg.innerHTML = ""
  }

  set error(value) {
    let { msg, svg } = this;
    if (value != null) {
      msg.innerHTML = value;
      this.fade = false;
    } else {
      this.fade = true;
    }
    svg.toggleAttribute('valid', value == null);
  }

  transform(x, y, scale, angle, group) {
    let p = new Vector(x, y);
    p = p.div(scale);
    p = p.rotate(-angle);
    let transform = `rotate(${angle * 180 / Math.PI}) scale(${s}) translate(${p.x}, ${p.y})`
    if (group) group.setAttribute('transform', transform);
    return transform;
  }
}

export class PopUpFrame extends SvgPlus {
  constructor() {
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
    this.popup.styles = { position: 'fixed', display: 'inline-block' };
    this.align = "center";
  }

  set align(name) {
    this.popup.align = name;
  }

  async showMessage(message, time) {
    let { popup } = this;
    popup.innerHTML = "";
    popup.createChild("div", { class: "msg", content: message });
    await this.show();
    if (time) {
      await delay(time);
      await this.hide();
    }
  }

  async prompt(message, responses) {
    if (typeof responses === "string") responses = [responses];
    let { popup } = this;
    popup.innerHTML = "";
    popup.createChild("div", { class: "msg", content: message });
    let btns = popup.createChild("div", { class: "btn-box" });
    for (let response of responses) {
      let btn = btns.createChild("div", { class: "btn", content: response })
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