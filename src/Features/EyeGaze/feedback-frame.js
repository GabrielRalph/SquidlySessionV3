import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { addProcessListener } from "../../Utilities/webcam.js";
import { OccupiableWindow } from "../features-interface.js";
import { getHostPresets } from "../VideoCall/presets.js";
import { FaceLandmarks } from "./Algorithm/Utils/face-mesh.js";

const used_points = [...new Set([152,10,389,162,473,468,33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7,362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382,61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109])]
const MaxTimeTillFade = 4000;

function getMinMax(points) {
    let min = new Vector(Infinity, Infinity);
    let max = new Vector(-Infinity, -Infinity);
    for (let p of points) {
        min.x = Math.min(min.x, p.x);
        min.y = Math.min(min.y, p.y);
        max.x = Math.max(max.x, p.x);
        max.y = Math.max(max.y, p.y);
    }
    return {min, max};
}

function getEyePath(points, w, h, path, scale = 1) {
    let ps = points.get2D(path, w, h);

    let {min, max} = getMinMax(ps);
    if (scale !== 1) {
        let center = max.add(min).div(2);
        ps = ps.map(p => p.sub(center).mul(scale).add(center));
        min = min.sub(center).mul(scale).add(center);
        max = max.sub(center).mul(scale).add(center);
    }
    
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
    return d + "Z";
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
        ["M"+[p1,p2,ip2,ip1].join("L")+"Z", pl.y < ip1.y || pr.y < ip1.y, "top"],
        ["M"+[p2,ip2,ip3,p3].join("L")+"Z", pr.x > ip2.x, "right"],
        ["M"+[p3,ip3,ip4,p4].join("L")+"Z", pl.y > ip3.y  || pr.y > ip3.y, "bottom"],
        ["M"+[p1,ip1,ip4,p4].join("L")+"Z", pl.x < ip1.x , "left"],
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

    _renderEyesOnly = false;

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
        this.header = this.createChild("div", {
            class: "f-header",
            styles: {
                position: "absolute",
                top: 0,
                left: 0,
            }
        })

        this.overlay = this.createChild("div", {
            class: "f-overlay",
        })

        this.svg = this.createChild("svg");
        this.svg.createChild("defs", {content:
            `<defs>
                <linearGradient id="border-gradient-top" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" class = "border-norm start"/>
                    <stop offset="100%" class = "border-norm end"/>
                </linearGradient>
                <linearGradient id="border-gradient-bottom" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" class = "border-norm end"/>
                    <stop offset="100%" class = "border-norm start"/>
                </linearGradient>
                <linearGradient id="border-gradient-left" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" class = "border-norm start"/>
                    <stop offset="100%" class = "border-norm end"/>
                </linearGradient>
                <linearGradient id="border-gradient-right" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" class = "border-norm end"/>
                    <stop offset="100%" class = "border-norm start"/>
                </linearGradient>

                <linearGradient id="border-gradient-top-hit" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" class = "border-hit start"/>
                    <stop offset="100%" class = "border-hit end"/>
                </linearGradient>
                <linearGradient id="border-gradient-bottom-hit" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" class = "border-hit end"/>
                    <stop offset="100%" class = "border-hit start"/>
                </linearGradient>
                <linearGradient id="border-gradient-left-hit" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" class = "border-hit start"/>
                    <stop offset="100%" class = "border-hit end"/>
                </linearGradient>
                <linearGradient id="border-gradient-right-hit" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" class = "border-hit end"/>
                    <stop offset="100%" class = "border-hit start"/>
                </linearGradient>
            </defs>`
        })
        this.svgStyle = this.svg.createChild("style", {content: `
            .border-norm {
                stop-color: #156082;
                stop-opacity: 1;
            }
            .border-norm.end {
                stop-opacity: 0;
            }
            .border-hit {
                stop-color: rgb(188, 13, 13);
                stop-opacity: 1;
            }
            .border-hit.end {
                stop-opacity: 0;
            }`
        })
        this.svgRenders = this.svg.createChild("g", {class: "renders"});
        
        this.aspect = 1;
       
    }

    renderBorder(w, h, bh, points, mx, my) {
        let html = "";
        let bpaths = makeBorderPath(w, h, bh, points, mx, my);
        for (let [path, isHit, name] of bpaths) {
            html += `<path style = "fill: url('#border-gradient-${name}${isHit ? "-hit" : ""}')"  class = "border" d = "${path}"></path>`;
        }
        return html;
    }

    /**
     * @param {Number} w
     * @param {Number} h
     * @param {Number} error
     * @param {FaceLandmarks} points
     */
    renderFaceAll(w, h, error, points, id) {
        const irisSize = 1.2;
        let html = "";
        let fill = `"hsl(${96*error}deg 90% 56% / 50%)"`;
        let stroke = `"hsl(${96*error}deg 90% 56%)"`;

        let eyeLeft= getEyePath(points, w, h, "eyes.left.outline", 1.4);
        let eyeRight = getEyePath(points, w, h, "eyes.right.outline", 1.4);
        let mouth = getEyePath(points, w, h, "mouth.outline", 1.15);
        let face = getEyePath(points, w, h, "outline", 1);

        let sizeL = points.get2D("eyes.left.top", w, h).dist(points.get2D("eyes.left.bottom", w, h)) * 1.4;
        let sizeR = points.get2D("eyes.right.top", w, h).dist(points.get2D("eyes.right.bottom", w, h)) * 1.4;
        
        html += `<defs>
            <clipPath id="cut-out-eyes-${id}">
                <path d= "${eyeLeft + eyeRight}"></path>
            </clipPath>
        </defs>`

        for (let [size, v] of [[sizeL, points.get2D("eyes.left.pupil", w, h)], [sizeR, points.get2D("eyes.right.pupil", w, h)]]) {
            html += `<path fill=${stroke} transform = "translate(${v.x}, ${v.y}) scale(${0.5 * size/100})" d="M35.2-5.778C17.886-5.778,3.85-19.292,3.85-35.962c0-2.576.343-5.072.982-7.455.871-3.251-1.393-6.576-4.759-6.582-.024,0-.049,0-.073,0-29.49,0-53.017,25.53-49.685,55.694,2.53,22.902,21.091,41.462,43.993,43.991C24.471,53.016,50,29.489,50,0c0-.703-.017-1.402-.049-2.097-.153-3.312-3.293-5.611-6.496-4.759-2.628.699-5.394,1.077-8.254,1.077Z"/>`
            html += `<circle stroke=${stroke} clip-path = "url(#cut-out-eyes-${id})" fill = "none" cx = "${v.x}" cy = "${v.y}" r = "${irisSize*size/2}"></circle>`
        }
        html += `<path fill =${fill} stroke-linejoin="round" stroke-width="1" stroke = ${stroke} d= "${face + eyeLeft + eyeRight + mouth}"></path>`
        
        return html;
    }

    /**
     * @param {Number} w
     * @param {Number} h
     * @param {Number} error
     * @param {FaceLandmarks} points
     */
    renderFaceEyes(w, h, error, points, id) {
        let fill = `"hsl(${96*error}deg 90% 56% / 50%)"`;
        let stroke = `"hsl(${96*error}deg 90% 56%)"`;

        let eyeLeft = getEyePath(points, w, h, "eyes.left.outline", 1.4);
        let eyeRight = getEyePath(points, w, h, "eyes.right.outline", 1.4);

        let sizeL = points.get2D("eyes.left.top", w, h).dist(points.get2D("eyes.left.bottom", w, h)) * 1.4;
        let sizeR = points.get2D("eyes.right.top", w, h).dist(points.get2D("eyes.right.bottom", w, h)) * 1.4;
        
        // Add eyes fill with iris mask
        let html = `<path mask="url(#remove-iris-mask-${id})" fill=${fill}  d="${eyeLeft + eyeRight}"></path>`

        let irises = "";
        for (let [size, v] of [[sizeL, points.get2D("eyes.left.pupil", w, h)], [sizeR, points.get2D("eyes.right.pupil", w, h)]]) {
            irises += `<circle fill = "black" cx = "${v.x}" cy = "${v.y}" r = "${1.3*size/2}"></circle>`
            html += `<circle clip-path = "url(#cut-out-eyes-${id})" stroke=${stroke} fill = "none" cx = "${v.x}" cy = "${v.y}" r = "${1.3*size/2}"></circle>`
            html += `<path fill=${stroke} transform = "translate(${v.x}, ${v.y}) scale(${0.5 * size/100})" d="M35.2-5.778C17.886-5.778,3.85-19.292,3.85-35.962c0-2.576.343-5.072.982-7.455.871-3.251-1.393-6.576-4.759-6.582-.024,0-.049,0-.073,0-29.49,0-53.017,25.53-49.685,55.694,2.53,22.902,21.091,41.462,43.993,43.991C24.471,53.016,50,29.489,50,0c0-.703-.017-1.402-.049-2.097-.153-3.312-3.293-5.611-6.496-4.759-2.628.699-5.394,1.077-8.254,1.077Z"/>`
        }

        // // Add eyes outline
        html += ``

        html = `
        <defs>
            <clipPath id="cut-out-eyes-${id}">
                <path d= "${eyeLeft + eyeRight}"></path>
            </clipPath>
            <mask id="remove-iris-mask-${id}">
                <rect x='0' y='0' width='${w}' height='${h}' fill='white'></rect>
                ${irises}
            </mask>
        </defs>
        ${html}
        <path fill = "none" stroke =${stroke} stroke-linejoin="round" stroke-width="1" d="${eyeLeft + eyeRight}"></path>`;
        
        return html;
    }

    renderThermometer(xPos, startY, endY, error, tw) {
        let fill = `"hsl(${96*error}deg 90% 56% / 50%)"`;
        let stroke = `"hsl(${96*error}deg 90% 56%)"`;
        let height = endY - startY;
        let filledHeight = height * error;
        return `
        <rect class="thermometer-bg" x="${xPos - tw/2}" y="${startY}" width="${tw}" height="${height}" rx="${tw/2}" ry="${tw/2}" stroke=${stroke} stroke-width="1"></rect>
        <rect class="thermometer-fill" x="${xPos - tw/2}" y="${startY + (height - filledHeight)}" width="${tw}" height="${filledHeight}" rx="${tw/2}" ry="${tw/2}" fill=${fill} ></rect>
        `;
    }

    render(){
        let {points, svg, svgRenders, width, height, aspect, clientWidth, clientHeight} = this;
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
                    html += this.renderFace(width, height, 1, this.avg, 2);
                }

                html += this.renderThermometer(width - (bh-mx)/2, (bh), height - (bh), op, bh/3);

                html += this.renderFace(width, height, op, points, 1)
                
                svgRenders.innerHTML = html;
                if (this.parentElement) {
                    this.parentElement.style.setProperty("--valid", op);
                }
            }
        }
    }

    set disabled(bool) {
        this.toggleAttribute("disabled", !!bool);
        
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


    set headerText(text) {
        this.header.textContent = text;
    }

    set userName(name) {
        let nameLow = name.toLowerCase();
        let mName = name;
        if (nameLow === "host") {
            mName = "The host"
        } else if (nameLow === "participant") {
            mName = "The participant"
        }
        this.headerText = name;
        this.overlay.innerHTML = `<h1>${mName} doesn't<br/>currently have<br/>eye gaze enabled!</h1>`;
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

    set renderEyesOnly(bool) {
        this._renderEyesOnly = !!bool;
    }

    get renderEyesOnly() {
        return this._renderEyesOnly;
    }

    get renderFace() {
        return this._renderEyesOnly ? this.renderFaceEyes : this.renderFaceAll;
    }
}

class FeedbackWidget extends SvgPlus {
    constructor(user){
        super("feedback-widget");

        this.fb = this.createChild(FeedbackFrame);
        let row = this.createChild("div");
        row.createChild(GridIcon, {}, {
            type: "starter",
            symbol: "calibrate",
            displayValue: "Calibrate",
            events: {
                "access-click": (e) => {
                   this.dispatchEvent(new AccessEvent("calibrate", e))
                }   
           }
        }, user + "-calibrate-button");

        row.createChild(GridIcon, {}, {
            type: "emphasis",
            symbol: "test",
            displayValue: "Test",
            events: {
                "access-click": (e) => {
                   this.dispatchEvent(new AccessEvent("test", e))
                }   
           }
        }, user + "-test-button");
  
    }

    start(){this.fb.start()}
    stop() {this.fb.stop()}

    /** @param {FaceLandmarks} d */
    set facePoints(d) {this.fb.facePoints = d}

    /** @param {FaceLandmarks} d */
    set onion(d) {this.fb.onion = d}

    set headerText(text) {
        this.fb.headerText = text;
    }
}

export class FeedbackWindow extends OccupiableWindow {
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
        super("feedback-window", "fade");
        this.sdata = sdata;
        this.session = session;

        let grid = this.createChild(GridLayout, {}, 3, 4);

        grid.add(new GridIcon({
            type: "action",
            symbol: "close",
            displayValue: "Exit",
            events: {
                "access-click": (e) => this.dispatchEvent(new AccessEvent("exit", e))
            }
        }), 0, 0);

        this.enableEyeGazeButton = grid.add(new GridIcon({
            type: "adjective",
            symbol: "eye",
            displayValue: "Enable eye gaze",
            events: {
                "access-click": (e) => {
                    this.session.settings.toggleValue(`${this.shownUser}/eye-gaze-enabled`);
                }
            }
        }), 0, 1);

        
        this.showUserButton = grid.add(new GridIcon({
            type: "adjective",
            symbol: "switch-user",
            displayValue: "Host",
            events: {
                "access-click": (e) => {
                    this.shownUser = this.shownUser === this.sdata.me ? this.sdata.them : this.sdata.me;
                    sdata.set("shown-feedback-user", this.shownUser);
                }
            }
        }), 1, 0);

        this.renderModeButton = grid.add(new GridIcon({
            type: "adjective",
            symbol: "show-eyes",
            displayValue: "Show eyes",
            events: {
                "access-click": (e) => {
                    this.toggleRenderMode();
                    sdata.set("feedback-show-eyes-only", this.feedback.renderEyesOnly);
                }
            }
        }), 1, 1);


        grid.add(new GridIcon({
            type: "topic-starter",
            symbol: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FvFWZT7iOGfm7aQkONjT7?alt=media&token=9c011d4c-fce7-4018-a7c9-8e19747a0555",
            displayValue: "Calibration settings",
            events: {
                "access-click": (e) => {
                    session.settings.gotoPath("home/host/calibration")
                    session.openWindow("settings");
                }
            }
        }), 2, 0);

        grid.add(new GridIcon({
            type: "topic-starter",
            symbol: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FVKtlw1GP6XQq0518M3C1?alt=media&token=1d403d43-ee1b-429f-8292-8aa8b9460be6",
            displayValue: "Access settings",
            events: {
                "access-click": (e) => {
                    session.settings.gotoPath("home/host/access")
                    session.openWindow("settings");
                }
            }
        }), 2, 1);
        
       
        this.feedback = grid.add(new FeedbackFrame(), 0, 2, 1, 3);

        this.calibrateButton = grid.add(new GridIcon({
            type: "noun",
            symbol: "calibrate",
            displayValue: "Calibrate",
            events: {
                "access-click": (e) => {
                    this.dispatchEvent(new AccessEvent("calibrate-"+this.shownUser, e))
                }   
        }
        }, "calibrate-button"), 2, 2);

        this.testButton = grid.add(new GridIcon({
                type: "emphasis",
                symbol: "test",
                displayValue: "Test",
                events: {
                    "access-click": (e) => {
                    this.dispatchEvent(new AccessEvent("test-"+this.shownUser, e))
                    }   
            }
        }, "calibrate-button"), 2, 3);

        
    }

    toggleRenderMode(bool) {
        if (typeof bool !== "boolean") {
            bool = !this.feedback.renderEyesOnly;
        }
        this.feedback.renderEyesOnly = bool;
        this.renderModeButton.symbol = bool ? "show-face" : "show-eyes";
        this.renderModeButton.displayValue = bool ? "Show face" : "Show eyes";
    }

    async updateHostName() {
        let presets = await getHostPresets(this.sdata.hostUID);
        this.host.headerText = presets.name || "Host";
    }


    async initialise(){
        const {sdata, session} = this

        addProcessListener(this._onProcess.bind(this));
        
        let hideTimeOut = null;
        session.videoCall.addEventListener("facepoints", (e) => {
            if (this.shownUser === sdata.them) {
                let {data} = e;
                let points = FaceLandmarks.deserialise(data, used_points);
                this._setFacePoints(points);
                clearTimeout(hideTimeOut);
                hideTimeOut = setTimeout(() => {
                    this._setFacePoints(null);
                }, MaxTimeTillFade)
            }
        });

        this.hostName = session.settings.get("host/profileSettings/name") || "Host";
        this.participantName = session.settings.get("participant/profileSettings/name") || "Participant";

        
        session.settings.addEventListener("change", (e) => {
            if (e.path.endsWith("eye-gaze-enabled")) {
                if (e.path.startsWith(this.shownUser)) {
                    this.disabled = !e.value;
                }
            } else if (e.path.endsWith("profileSettings/name")) {
                console.log("Feedback: User name changed for", e.path.split("/")[0], "new name:", e.value);
                let user = e.path.split("/")[0];
                this[user + "Name"] = e.value || (user === "host" ? "Host" : "Participant");
                if (this.shownUser === user) {
                    this.feedback.name = this[user + "Name"];
                }
            }
        })

        sdata.onValue(`onion/${sdata.them}`, (str) => {
            let onion = FaceLandmarks.deserialise(str, used_points);
            this[sdata.them + "Onion"] = onion;
            if (this.shownUser === sdata.them) {
                this.feedback.onion = onion;
            }
        })

        sdata.onValue(`onion/${sdata.me}`, (str) => {
            let onion = FaceLandmarks.deserialise(str, used_points);
            this[sdata.me + "Onion"] = onion;
            if (this.shownUser === sdata.me) {
                this.feedback.onion = onion;
            }
        })

        sdata.onValue("feedback-show-eyes-only", (val) => {
            this.toggleRenderMode(!!val);
        });

        sdata.onValue("shown-feedback-user", (user) => {
            this.shownUser = user;
        })
    }


    /** Sets which user's feedback to show
     * @param {"host"|"participant"} user
     */
    set shownUser(user) {
        let shownUser = user === "host" ? "host" : "participant";
        this._shownUser = shownUser;
        this.feedback.onion = this[shownUser + "Onion"] || null;
        this.feedback.userName = this[shownUser + "Name"]
        this.disabled = !this.session.settings.get(shownUser + "/eye-gaze-enabled");
        this.showUserButton.displayValue = this[shownUser + "Name"];
    }


    set disabled(bool) {
        bool = !!bool;
        this.feedback.disabled = bool;
        this.renderModeButton.disabled = bool;
        this.calibrateButton.disabled = bool;
        this.testButton.disabled = bool;
        this.enableEyeGazeButton.symbol = bool ? "noeye" : "eye";
        this._disabled = bool;
    }
    get disabled() {
        return this._disabled;
    }
    
    /**
     * @return {"host"|"participant"} user which feedback is currently shown
     */
    get shownUser() {
        return this._shownUser;
    }   

    /** Sets the onion for the current user and sends it to the other peer
     * @param {FaceLandmarks} onion 
     * */
    setOnion(onion) {
        const {sdata} = this
        this[sdata.me + "Onion"] = onion;
        if (this.shownUser === sdata.me) {
            this.feedback.onion = onion;
        }
        let str = onion.serialise(used_points);
        sdata.set(`onion/${sdata.me}`, str);
    }

    async open(){
        this.isOpen = true;
        this.dispatchEvent(new Event("open"));
        await this.show(400);
    }

    async close(){
        this.isOpen = false;
        this._setFacePoints(null, this.sdata.me);
        this._setFacePoints(null, this.sdata.them);
        this.dispatchEvent(new Event("close"));
        await this.hide(400);
    }


    /** @param {{points: FaceLandmarks?}} data*/
    _onProcess(data) {
        const {sdata} = this;
        if (this.isOpen && this.shownUser === sdata.me) {
            
            let points = null;
            let str = null;
            if ("points" in data && data.points instanceof FaceLandmarks) {
                points = data.points;
                str = points.serialise(used_points);
            }

            this._setFacePoints(points);
            this.session.videoCall.sendData("facepoints", str);
        }
    }

    _setFacePoints(facePoints) {
        if (!(facePoints instanceof FaceLandmarks)) {
            this.feedback.toggleAttribute("hide", true);
            this.feedback.stop();
        } else {
            this.feedback.start();
            this.feedback.toggleAttribute("hide", false);
            let invalid = facePoints.width == 0 || facePoints.isOutside;
            this.feedback.toggleAttribute("invalid", invalid)
            this.feedback.facePoints = facePoints.width == 0 ? null : facePoints; 
        }
    }
   

    static get fixToolBarWhenOpen() {return true}
    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta), GridIcon.styleSheet]
    }
}

