import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton, AccessEvent } from "../../Utilities/access-buttons.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { addProcessListener } from "../../Utilities/webcam.js";
import { OccupiableWindow } from "../features-interface.js";
import { FaceLandmarks } from "./Algorithm/Utils/face-mesh.js";

const used_points = [...new Set([152,10,389,162,473,468,33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7,362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382,61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109])]
const MaxTimeTillFade = 4000;

function getEyePath(points,w, h, path = left_eye_outline, mode = true) {
    if (mode) {
        let ps = points.get2D(path, w, h);
        
        let tgs = [];
        for (let i =0; i < ps.length; i++) {
            let i_last = (i - 1 + ps.length) % ps.length;
            let i_next = (i + 1) % ps.length;
            let tg = ps[i_next].sub(ps[i_last]).div(5.2);
            tgs.push(tg);
        }

        let d = "M" + ps[0];

        for (let i = 1; i < ps.length; i++) {
            let v2 = ps[i];
            let tg1 = ps[i - 1].add(tgs[i-1]);
            let tg2 = ps[i].sub(tgs[i]);
            d += "C"+tg1+","+tg2 +","+v2
        }
        return d + "Z"
    }
    return "M" + path.map(i => {
        let {x, y} = points[i];
        return [x*w, y*h]
    }).join("L") + "Z";

}

function makeBorderPath(w, h, th, points, mx, my) {
    let p1 = new Vector(-mx, -my);
    
    let p2 = p1.addH(w);
    let p3 = p2.addV(h);
    let p4 = p1.addV(h);


    let ip1 = p1.add(th+mx, th+my);
    let ip2 = p2.add(-th-mx, th+my);
    let ip3 = p3.add(-th-mx, -th-my);
    let ip4 = p4.add(th+mx, -th-my);

    let pl = points.get2D("eyes.left.pupil", w-2*mx, h-2*my);
    let pr = points.get2D("eyes.right.pupil", w-2*mx, h-2*my);

    return [
        ["M"+[p1,p2,ip2,ip1].join("L")+"Z", pl.y < ip1.y || pr.y < ip1.y],
        ["M"+[p2,ip2,ip3,p3].join("L")+"Z", pr.x > ip2.x],
        ["M"+[p3,ip3,ip4,p4].join("L")+"Z", pl.y > ip3.y  || pr.y > ip3.y],
        ["M"+[p1,ip1,ip4,p4].join("L")+"Z", pl.x < ip1.x ],
    ]
}

export class FeedbackFrame extends SvgPlus {

    /** @type {Number} */
    size = 400;

    /** @type {FaceLandmarks} */
    points = [];

    /** @type {HTMLVideoElement} */
    video = null;

    /** @type {SVGSVGElement & SvgPlus} */
    svg = null;

    /** @type {FaceLandmarks} */
    avg

    constructor() {
        super("feedback-frame");
        this.styles = {
            position: "relative",
        }
        this.video = this.createChild("video", {
            muted: true,
            playsinline: true,
            autoplay: true,
            styles: {
                "position": "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                "z-index": -1,
                width: "100%"
            }
        });
        this.svg = this.createChild("svg");
        this.aspect = 1;
    }

    renderBorder(w, h, bh, points, mx, my) {
        let html = "";
        let bpaths = makeBorderPath(w, h, bh, points, mx, my);
        for (let [path, isHit] of bpaths) {
            html += `<path ${isHit ? "hit" : ""} class = "border" d = "${path}"></path>`;
        }
        return html;
    }

    renderFace(w, h, error, points) {
        let html = "";
        let fill = `"hsl(${96*error}deg 90% 56% / 50%)"`;
        let stroke = `"hsl(${96*error}deg 90% 56%)"`;
        html += `<path fill =${fill} stroke-linejoin="round" stroke-width="1" stroke = ${stroke} d= "${getEyePath(points,w,h, "outline", true)}${getEyePath(points, w, h, "eyes.left.outline")}${getEyePath(points, w, h, "mouth.outline")}${getEyePath(points, w, h, "eyes.right.outline")}"></path>`
        for (let v of [points.get2D("eyes.left.pupil", w, h), points.get2D("eyes.right.pupil", w, h)]) {
            html += `<circle fill=${stroke} cx = "${v.x}" cy = "${v.y}" r = "2"></circle>`
        }
        return html;
    }

    render(){
        let {points, svg, width, height, aspect, clientWidth, clientHeight} = this;
        if (clientWidth > 1 && clientHeight > 1)  {
            let aa = this.clientWidth / this.clientHeight;
            let pH = width / aa;
            let pW = width;
            let mx = 0;
            let my = 0;
    
            // View is more landscap then camera
            if (aa > aspect) {
                pW = width;
                height = pH;
                width = pH * aspect;
                mx = (pW - width) / 2;
            } else {
                my = (pH - height) / 2;
    
            }
    
            svg.props = {
                viewBox: `${-mx} ${-my} ${pW} ${pH}`
            }
    
            if (points.length > 400) {
                let bh = width * FaceLandmarks.borderWidthRatio;
    
                let html = this.renderBorder(pW, pH, bh, points, mx, my);
                
                let op = points.faceFrameQualityMetric;
                
                if (this.avg) {
                    op = this.avg.averageDistance(points) * 40;
                    op =(1 - (op > 1 ? 1 : op)) ** 0.5;
                    html += this.renderFace(width, height, 1, this.avg);
                }
                html += this.renderFace(width, height, op, points)
                
                svg.innerHTML = html;
                if (this.parentElement) {
                    this.parentElement.style.setProperty("--valid", op);
                }
            }
        }
    }

    stop(){}
    async start() {
        if (this._started) return;
        this._started = true;
        let stop = false;
        this.stop = () => {stop = true}
        while(!stop) {
            this.render();
            await delay()
        }
        this._started = false;
    }


    get width(){
        return this.size;
    }
    get height(){
        return this.size / this.aspect;
    }


    /** @param {MediaStream} stream */
    set stream(stream){
        // this.video.srcObject = stream;
        // window.requestAnimationFrame(() => {
        //     this.aspect = this.video.videoWidth / this.video.videoHeight
        // })
    }

    /** 
     * @param {Number} aspect
     */
    set aspect(aspect){
        if (typeof aspect !== "number" || Number.isNaN(aspect)) aspect = 1;
        this._aspect = aspect;
    }

    /** @return {Number} */
    get aspect(){
        return this._aspect
    }

    /** @param {FaceLandmarks} facePoints */
    set onion(facePoints) {
        if (facePoints instanceof FaceLandmarks) {
            this.avg = facePoints;
        }
    }

    /** @param {FaceLandmarks} facePoints */
    set facePoints(facePoints) {
        if (facePoints instanceof FaceLandmarks) {
            this.points = facePoints;
            this.aspect = facePoints.aspect;
        }
    }
}


class FeedbackWidget extends SvgPlus {
    constructor(){
        super("feedback-widget");

        this.fb = this.createChild(FeedbackFrame);
        let row = this.createChild("div");
        let b1 = row.createChild(AccessButton, {events: {
            "access-click": (e) => {
               this.dispatchEvent(new AccessEvent("calibrate", e))
            }   
        }}, "calibrate");
        b1.createChild(Icon, {}, "calibrate")
        b1.createChild("div", {content: "Calibrate"})

        let b2 = row.createChild(AccessButton, {
            class: "test",
            events: {
                "access-click": (e) => {
                   this.dispatchEvent(new AccessEvent("test", e))
                }   
           }
        }, "calibrate");
        b2.createChild(Icon, {}, "test")
        b2.createChild("div", {content: "Test"})
    }

    start(){this.fb.start()}
    stop() {this.fb.stop()}

    /** @param {FaceLandmarks} d */
    set facePoints(d) {this.fb.facePoints = d}

    /** @param {FaceLandmarks} d */
    set onion(d) {this.fb.onion = d}
}

export class FeedbackWindow extends OccupiableWindow {
    /**@type {HideShow} */
    // root = null;

    /**@type {FeedbackFrame} */
    participant = null;

    /**@type {FeedbackFrame} */
    host = null;

    /**@type {CalibrationFrame} */
    main = null; 

    /** @type {import("../features-interface.js").SessionDataFrame} */
    sdata = null;

    /** @type {import("../features-interface.js").SquidlySession} */
    session = null;

    constructor(session, sdata) {
        let root = new HideShow("feedback-window");
        root.applyShownState = () => {
            root.styles = {
                "pointer-events": "all",
                "opacity": 1,
            }
        }
        super("feedback-window", root);
        this.sdata = sdata;
        this.session = session;

        // Create header and close icon
        let head = this.createChild("div", {class: "header"});
        head.createChild("h1", {content: "Get into view to </br> start the calibration"});
        let b = head.createChild(AccessButton, {
            events: {
                "access-click": (e) => this.dispatchEvent(new AccessEvent("exit", e))
            }
        }, "calibrate")
        b.createChild(Icon, {}, "close");
        b.createChild("div", {content: "Exit"})

        // Create host and participant widgets
        let main = this.createChild("div", {class: "main"});
        this.participant = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new AccessEvent("calibrate-participant", e)),
            "test": (e) => this.dispatchEvent(new AccessEvent("test-participant", e))
        }});
        this.host = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new AccessEvent("calibrate-host", e)),
            "test": (e) => this.dispatchEvent(new AccessEvent("test-host", e))
        }});
    }


    async initialise(){
        const {sdata} = this

        addProcessListener(this._onProcess.bind(this));
        
        let hideTimeOut = null;
        this.session.videoCall.addEventListener("facepoints", (e) => {
            let {data} = e;
            let points = FaceLandmarks.deserialise(data, used_points);
            this._setFacePoints(points, sdata.them);
            clearTimeout(hideTimeOut);
            hideTimeOut = setTimeout(() => {
                this._setFacePoints(null, sdata.them);
            }, MaxTimeTillFade)
        });

        // sdata.onValue(`feedback-points/${sdata.them}`, (str) => {
            
        // });

        sdata.onValue(`onion/${sdata.them}`, (str) => {
            let onion = FaceLandmarks.deserialise(str, used_points);
            this[sdata.them].onion = onion;
        })

        sdata.onValue(`onion/${sdata.me}`, (str) => {
            let onion = FaceLandmarks.deserialise(str, used_points);
            this[sdata.me].onion = onion;
        })
    }

    /** @param {FaceLandmarks} onion */
    setOnion(onion) {
        const {sdata} = this
        this[sdata.me].onion = onion;
        let str = onion.serialise(used_points);
        sdata.set(`onion/${sdata.me}`, str);
    }

    async open(){
        this.isOpen = true;
        this.dispatchEvent(new Event("open"));
        await this.root.show(400);
    }

    async close(){
        this.isOpen = false;
        this.dispatchEvent(new Event("close"));
        await this.root.hide(400);
    }


    /** @param {{points: FaceLandmarks?}} data*/
    _onProcess(data) {
        const {sdata} = this;
        if (this.isOpen) {
            
            let points = null;
            let str = null;
            if ("points" in data && data.points instanceof FaceLandmarks) {
                points = data.points;
                str = points.serialise(used_points);
            }

            this._setFacePoints(points, sdata.me);
            this.session.videoCall.sendData("facepoints", str);
            // sdata.set(`feedback-points/${sdata.me}`, str);
        }
    }

    _setFacePoints(facePoints, user) {
        if (!(facePoints instanceof FaceLandmarks)) {
            this[user].toggleAttribute("hide", true);
            this[user].stop();
        } else {
            this[user].start();
            this[user].toggleAttribute("hide", false);
            let invalid = facePoints.width == 0 || facePoints.isOutside;
            this[user].toggleAttribute("invalid", invalid)
            this[user].facePoints = facePoints.width == 0 ? null : facePoints; 
        }
    }

   

    static get fixToolBarWhenOpen() {return true}
    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta)]
    }
}

