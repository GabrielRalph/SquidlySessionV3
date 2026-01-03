import { delay, makeLogger, relURL } from "../../Utilities/usefull-funcs.js";
import { SvgPlus, Vector } from "../../SvgPlus/4.js"
import * as PDF from "./pdfjs/pdf.mjs"
import * as PDFWorker from './pdfjs/pdf.worker.mjs';
import { OccupiableWindow } from "../features-interface.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { GridIcon } from "../../Utilities/Buttons/grid-icon.js";

/**
 * @typedef {Object} ContentInfo
 * @property {("pdf"|"image"|"stream"|"none")} type
 * @property {string} url
 * @property {number} page
 */

PDF.GlobalWorkerOptions.workerSrc = PDFWorker;

const log = makeLogger("PDF Viewer", "color: orange;");


function hasKey(object, key) {
  if (typeof object === "object" && object !== null) {
    return key in object;
  }
  return false;
}


async function renderPDF(canvas, pdfDoc, pageNum, maxDimension) {
  let t0 = performance.now();
  let page = await pdfDoc.getPage(pageNum);

  // Set scale
  const VP = page.getViewport({ scale: 1 });
  const maxVPD = Math.max(VP.height, VP.width);
  const scale = maxDimension / maxVPD;
  const viewport = page.getViewport({ scale: scale })
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: canvas.getContext("2d", { willReadFrequently: true }),
    viewport: viewport
  }).promise;
}

class ContentFrame extends SvgPlus {
  transformable = true;
  _scale = 1;
  _offset = new Vector();

  constructor() {
    super("content-frame");
   
    this.image = this.createChild("div", {
      class: "image",
      events: {
        'dragstart': e => e.preventDefault()
      }
    });

    this.canvas = this.createChild("canvas", { width: 1000, height: 1000 });

    /** @type {HTMLCanvasElement} */
    this.streamCanvas = this.createChild("canvas", {styles: {display: "none"}});
    this.streamCtx = this.streamCanvas.getContext("2d", { willReadFrequently: true });

    this.video = this.createChild("video", { playsinline: true, muted: true, autoplay: true });

    let icons = this.createChild("div", { class: "pdf-controls" });
    this.icons = icons;
    this.middle_icon = icons.createChild("div", { class: "bottom-middle" });

    this.updateVideo();
  }

  addControlEvents(root) {
    let last = null;
    let selected = false;
    root.events = {

      mousewheel: (e) => {
        if (this.transformable) {
          let pixelPos = new Vector(e.clientX, e.clientY);
          let wscale = 600 / this.scale;
          if (e.ctrlKey) wscale = 7000 / this.scale;
          this.scaleAtPoint(pixelPos, e.wheelDeltaY / wscale);
          e.preventDefault();
        }
      },

      mousemove: (e) => {
          if (selected && e.buttons == 1 && this.transformable) {
            let point = new Vector(e.clientX, e.clientY);
            if (last == null) last = point;
            let delta = point.sub(last);
            let [pos, size] = this.displayBBox;
            let deltaRel = delta.div(size);
            let newOffset = this.offset.add(deltaRel);
            this.offset = newOffset;
            last = point;
            this.transformEvent();
            e.preventDefault();
          }
      },

      mousedown: (e) => {
        selected = true;
        e.preventDefault();
      },

      mouseleave: () => {
        last = null; selected = false;
        
      },

      mouseup: (e) => {
        last = null; selected = false;
        e.preventDefault();

      },

      dblclick: () => {
        if (this.transformable) {
            this.resetTransform();
        }
      }

    }
  }

  async stopUpdatingVideo(){}
  async updateVideo() {
    if (this.updatingVideo) return;

    let stop = false;

    let updatingLoop = async () => {
      this.updatingVideo = true
      console.log("%cupdating video", 'color: white; background: red;');
      
      while (!stop) {
        if (this.displayType == "stream" && this.video.videoWidth > 0) {
          this.streamCanvas.width = this.video.videoWidth;
          this.streamCanvas.height = this.video.videoHeight;
          this.streamCtx.drawImage(this.video, 0, 0, this.streamCanvas.width, this.streamCanvas.height);
        }
        await delay();
      }
      console.log("%cupdating video stopped", 'color: white; background: red;');

    }

    let prom = updatingLoop();
    this.stopUpdatingVideo = async () => {
      this.updatingVideo = false;
      stop = true;
      await prom;
    }

    await prom;
  }

  transformEvent(mode = "I", scale = this.scale, offset = this.offset) {
    const event = new Event("transform", { bubbles: true });
    event.transform = `${scale.toPrecision(5)},${offset},${mode}`;
    this.dispatchEvent(event);
  }

  resetTransform() {
    let dscale = this.scale - 1;
    let offset = this.offset;
    this.transformEvent("T", 1, new Vector());
    this.waveTransition((t) => {
      this.scale = 1 + dscale * t;
      this.offset = offset.mul(t);
    }, 500, false);
  }

  scaleAtPoint(point, scaleDelta) {
    let scale = this.scale;
    let scale2 = scale + scaleDelta;
    if (scale2 < 0.3) scale2 = 0.3;
    if (scale2 > 8) scale2 = 8;

    let [pos, size] = this.displayBBox;
    let center = pos.add(size.div(2));

    let offset = point.sub(center);


    let o2 = offset.mul(scale2 / scale);
    let delta = o2.sub(offset).div(size.mul(scale2 / scale));

    this.scale = scale2;
    this.offset = this.offset.mul(scale / scale2).sub(delta);
    this.transformEvent()
  }

  zoomAtCenter(scaleDelta) {
    let [pos,size] = this.bbox;
    this.scaleAtPoint(pos.add(size.div(2)), scaleDelta)
  }

  moveDelta(delta) {
    let defaultDelta = new Vector(0.05, 0.05);
    defaultDelta = defaultDelta.div(this.scale)
    let deltaRel = delta.mul(defaultDelta);
    this.offset = this.offset.add(deltaRel);
    this.transformEvent();
  }

  /** @param {MediaStream} stream  */
  set stream(stream) {
    this.video.srcObject = stream;
  }

  /** @param {string} url  */
  set imageSrc(url) {
    this.image.styles = { "background-image": `url(${url})` };

  }

  /** @param {string} trans  */
  set contentTransform(trans) {
    // log("transform", trans)
    let [scale, ox, oy, type] = trans.split(",");
    scale = parseFloat(scale);
    let offset = new Vector(parseFloat(ox), parseFloat(oy));
    if (type == "T") {
      let o1 = this.offset;
      let s1 = this.scale;
      this.waveTransition((t) => {
        this.scale = s1 * (1 - t) + scale * t;
        this.offset = o1.mul(1 - t).add(offset.mul(t));
      }, 500, true)
    } else {
      this.scale = scale;
      this.offset = offset;
    }
  }

  /** @param {number} x  */
  set scale(x) {
    this.styles = { "--scale": x };
    this._scale = x
  }
  
  get scale() { return this._scale; }


  /** @param {Vector} v  */
  set offset(v) {
    this.styles = { "--offset-x": v.x * 100 + "%", "--offset-y": v.y * 100 + "%" };
    this._offset = v.clone()
  }

  get offset() { return this._offset; }


  /** @param {("pdf" | "image" | "stream")} type  */
  set displayType(type) {
    if (type == "stream") {
      this.updateVideo();
    } else {
      this.stopUpdatingVideo();
    }
    this._displayType = type;
    this.canvas.styles = { display: type == "pdf" ? null : "none" };
    this.image.styles = { display: type == "image" ? null : "none" };
    this.streamCanvas.styles = { display: type == "stream" ? null : "none" };
  }

  get displayType() {
    return this._displayType;
  }

  get displayBBox() {
    if (this.displayType == "pdf") return this.canvas.bbox;
    else if (this.displayType == "stream") return this.streamCanvas.bbox;
    else return this.image.bbox;
  }

}

class ToolIcon extends GridIcon {
  constructor(name, text, type = "action") {
    super({displayValue: text, symbol: name, type, hidden: false}, "share-tools");
  }
}

class Loader extends HideShowTransition {
  constructor(){
    super("file-loader");
    this.icon = this.createChild(Icon, {}, "file");
    this.text = this.icon.createChild("text", {
      "text-anchor": "middle",
    })
    this.path = this.icon.querySelector("path");
    this.path.style.setProperty("--length", this.path.getTotalLength())
  }

  /**
   * @param {number} p
   */
  set progress(p){
    if (typeof p !== "number") p = 0;
    this.toggleAttribute("progress", p > 0);
    this.style.setProperty("--progress", p);

    let [pos, size] = this.icon.svgBBox;
    let center = pos.add(size.div(2));
    let fs = size.x / 4;
    this.text.props = {
      x: center.x,
      y: center.y + 0.6 * fs,
      "font-size": fs,
      content: Math.round(p * 100) + "%"
    }
  }
}

export class ContentViewer extends OccupiableWindow {

  /** @type {{promise: Promise, abort: function}} */
  loadingPDFPromise = null;

  /** @type {ContentFrame} */
  content = null

  /** @type {Object<string, MediaStream>} */
  stream = {};
  

  constructor(feature) {
    super("content-viewer");
    this.shareContent = feature;
    this._pageNumber = 1;
    
    this._displayType = null;
   

    this.content = this.createChild(ContentFrame);
    this.content.addControlEvents(this);
    this.createChild("border-frame");
    this._make_tools();
    this.loader = this.createChild(Loader)
  }

  _make_tools(){
    let open = false;
    let iconsList = this.createChild("div", {class: "tool-bar-area", events: {
      /** @param {Event} e */
      dblclick: (e) => {
        e.stopImmediatePropagation();
      }
    }});

    // let r1 = iconsList.createChild("div", {class: "row"})
    let openIcon = iconsList.createChild(ToolIcon, {
      name: "toggle",
      events: {
        "access-click": () => {
          open = !open;
          iconsList.toggleAttribute("open", open);
          openIcon.displayValue = open ? "hide" : "show"
          openIcon.symbol = open ? "minus" : "add"
        }
      }
    }, "add", "show", "topic-action");


    // let r1 = iconsList.createChild("div", {class: "row"})

    iconsList.createChild(ToolIcon, {showable: true, name: "zoom-in", events: {
      "access-click": () => this.content.zoomAtCenter(0.2)
    }}, "zoomIn", "zoom in");

    iconsList.createChild(ToolIcon, {showable: true, name: "zoom-out", events: {
      "access-click": () => this.content.zoomAtCenter(-0.2)
    }}, "zoomOut", "zoom out");

    iconsList.createChild(ToolIcon, {showable: true, name: "file", events: {
      "access-click": (e) => this.root.dispatchEvent(new AccessEvent("upload", e))
    }}, "file", "file");


    iconsList.createChild(ToolIcon, {showable: true, name: "screen", events: {
      "access-click": (e) => this.root.dispatchEvent(new AccessEvent("screen", e))
    }}, "screen", "share screen");


    iconsList.createChild(ToolIcon, {showable: true, name: "exit", events: {
      "access-click": (e) => this.root.dispatchEvent(new AccessEvent("close", e))
    }}, "close", "exit");

    iconsList.createChild(ToolIcon, {showable: true, name: "reset", events: {
      "access-click": () => this.content.resetTransform()
    }}, "refresh", "reset");

    iconsList.createChild(ToolIcon, {showable: true, name: "back", events: {
      "access-click": () => this.page--
    }}, "back", "back");

    iconsList.createChild(ToolIcon, {showable: true,  name: "next", events: {
      "access-click": () => this.page++
    }}, "next", "next");


    iconsList.createChild(ToolIcon, {showable: true, name: "left", events: {
      "access-click": () => this.content.moveDelta(new Vector(-1, 0))
    }}, "leftArrow", "left");

    iconsList.createChild(ToolIcon, {showable: true, name: "right", events: {
      "access-click": () => this.content.moveDelta(new Vector(1, 0))
    }}, "rightArrow", "right");

    iconsList.createChild(ToolIcon, {showable: true, name: "up", events: {
      "access-click": () => this.content.moveDelta(new Vector(0, -1))
    }}, "upArrow", "up");

    iconsList.createChild(ToolIcon, {showable: true, name: "down", events: {
      "access-click": () => this.content.moveDelta(new Vector(0, 1))
    }}, "downArrow", "down")

    this.iconsList = iconsList;
  }


  set page(value) {
    if (value < 1) value = 1;
    let { totalPages, pdfDoc } = this;
    if (value > totalPages && pdfDoc) value = totalPages;

    if (value != this._pageNumber) {
      this.iconsList.toggleAttribute("no-back", value === 1);
      this.iconsList.toggleAttribute("no-next", value === totalPages);
      this._pageNumber = value;
      this.root.dispatchEvent(new Event("page"))
      this.renderPage();
    }
  }

  get page() {
    return this._pageNumber;
  }

  get pageNum() {
    return this._pageNumber;
  }

  get totalPages() {
    if (hasKey(this.pdfDoc, "numPages")) {
      return this.pdfDoc.numPages
    }
    return 0;
  }

  setStream(stream, user) {
    this.stream[user] = stream;
    if (this.displayType == "stream" && this.streamUser == user) {
      this.content.stream = stream;
    }
  }

  /** @param {string} type */
  set displayType(type) {
    this._displayType = type;
    this.content.displayType = type;
    this.root.setAttribute("display-type", type);
  }

  get displayType() {
    return this._displayType;
  }

  /**
   * @param {ContentInfo} contentInfo 
   */
  async updateContentInfo(contentInfo) {
    log("content update", contentInfo);
    if (contentInfo == null) {
      this.displayType = null;
      this._url = null;
    } else {
      let { url, page, type } = contentInfo;
      log(url == this.url ? "same pdf" : "new pdf");

      // Change of content
      if (url != this.url) {
        this.displayType = type;
        switch (type) {
          case "pdf":
            this._pageNumber = page;
            await this.loadPDF(url);
            break;

          case "stream":
            console.log("setting share stream", contentInfo.page);
            this.streamUser = contentInfo.page;
            this.content.stream = this.stream[contentInfo.page];
            this.loader.progress = 1;
            this.loader.hide(500);
            break;

          case "image":
            this.content.imageSrc = url;
            this.loader.progress = 1;
            this.loader.hide(500);
            this._url = url;
            break;
        }

        // Change of page
      } else if (page != this.page) {
        this.page = page;
      }
    }
  }

  async loadPDF(url) {
    let aborted = false;
    let abort = () => { aborted = true; }
    let pfunc = async () => {
      this.loader.show(400);
      let t0 = performance.now();
      log(`loading pdf`)
      this.loader.progress = 0.8
      this._url = url;
      let doc = await PDF.getDocument(url).promise;
      if (!aborted) {
        this.loader.progress = 0.9
        log(`load pdf took ${performance.now() - t0}ms`)
        this.pdfDoc = doc;
        this.root.setAttribute("pages", this.totalPages);
        if (this.pageNum < 1 || this.pageNum > this.totalPages) this._pageNumber = 1;
        this.iconsList.toggleAttribute("no-back", this.page === 1);
        this.iconsList.toggleAttribute("no-next", this.page === this.totalPages);
        await this.renderPage();
        this.loader.progress = 1;
        this.displayType = "pdf";
        await this.loader.hide();
      }
    }

    if (this.loadingPDFPromise != null) {
      this.loadingPDFPromise.abort();
    }

    this.loadingPDFPromise = { promise: pfunc(), abort }
    await this.loadingPDFPromise.promise;
    this.loadingPDFPromise = null;
  }

  async open(){
    this.shareContent.session.cursors.updateReferenceArea("fixedAspectArea");
    await this.show();
  }

  async close(){
    this.shareContent.session.cursors.updateReferenceArea("entireScreen");
    this.shareContent.stopSharing();
    await this.hide();
  }

  get url() {
    return this._url;
  }

  async renderPage() {
    let { content, pdfDoc, pageNum } = this;
    if (pdfDoc) {
      if (this._render_prom instanceof Promise) {
        await this._render_prom
      }

      let maxDimension = Math.max(window.innerWidth, window.innerHeight) * 3;

      this._render_prom = renderPDF(content.canvas, pdfDoc, pageNum, maxDimension);
      await this._render_prom;
      this._render_prom = null;
    }
  }

  static get usedStyleSheets() {
    return [relURL("./styles.css", import.meta), GridIcon.styleSheet]
  }

  static get fixToolBarWhenOpen() {return true}
}

