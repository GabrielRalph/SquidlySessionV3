import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { addProcessListener } from "../../Utilities/webcam.js";
import { OccupiableWindow } from "../features-interface.js";
import { getHostPresets } from "../VideoCall/presets.js";
import { FaceLandmarks } from "./Algorithm/Utils/face-mesh.js";

const used_points = [...new Set([152,10,389,162,473,468,33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7,362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382,61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109])]
const MaxTimeTillFade = 3000;

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

    /** @type {SVGSVGElement & SvgPlus} */
    svg = null;

    /** @type {FaceLandmarks} */
    avg

    valid = false;


    constructor() {
        super("feedback-frame");
        this.styles = {
            position: "relative",
        }

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

    /**
     * Renders the border indicating the valid head area.
     * @param {Number} w the width of the feedback display
     * @param {Number} h the height of the feedback display
     * @param {Number} bh the thickness of the border
     * @param {FaceLandmarks} points the current face points to determine where the user is looking
     * @param {Number} mx the horizontal margin to account for when rendering the border
     * @param {Number} my the vertical margin to account for when rendering the border
     */
    renderBorder(w, h, bh, points, mx, my) {
        let html = "";
        let bpaths = makeBorderPath(w, h, bh, points, mx, my);
        let hittingBorder = false;
        for (let [path, isHit, name] of bpaths) {
            html += `<path style = "fill: url('#border-gradient-${name}${isHit ? "-hit" : ""}')"  class = "border" d = "${path}"></path>`;
            hittingBorder = hittingBorder || isHit;
        }
        return html;
    }

    /** Renders the face with all details (eyes, mouth, outline)
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

    /** Renders the face with only the eyes details (no mouth or outline)
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

    /**
     * Renders a thermometer on the side of the feedback display to indicate 
     * the error level of the face points (i.e. how well the face points are detected).
     * The thermometer empties and turns more red as the error level increases.
     * @param {Number} xPos - The x position of the center of the thermometer
     * @param {Number} startY - The y position of the top of the thermometer
     * @param {Number} endY - The y position of the bottom of the thermometer
     * @param {Number} error - The error level between 0 and 1, where 0 is no error and 1 is maximum error
     * @param {Number} tw - The width of the thermometer
     */
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

    /**
     * Renders the feedback display, including the face and the border indicating where the user is looking.
     */
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
                
                const {onion} = this;
                if (onion) {
                    op = onion.averageDistance(points) * 40;
                    op =(1 - (op > 1 ? 1 : op)) ** 0.5;
                    html += this.renderFace(width, height, 1, onion, 2);
                }

                html += this.renderThermometer(width - (bh-mx)/2, (bh), height - (bh), op, bh/3);

                html += this.renderFace(width, height, op, points, 1)
                
                svgRenders.innerHTML = html;
            }
        }
    }

    /**
     * Sets whether the feedback is disabled (e.g. because eye gaze isn't enabled or because
     * face points are invalid) and updates the display accordingly.
     * @param {(boolean|"nodata"|"disabled"|"inactive")} value whether feedback is disabled or not.
     */
    set disabled(value) {
        if (value !== "invalid") {
            if (value in this.messages) {
                this.overlay.innerHTML = this.messages[value];
            } else {
                this.overlay.innerHTML = this.messages["nodata"];
            }
            this.toggleAttribute("disabled", !!value);
        }
    }

    /**
     * Stops the feedback rendering loop. 
     */
    stop(){}

    /**
     * Starts the feedback rendering loop.
     */
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


    /**
     * Sets the name of the user whose feedback is being shown and updates the messages accordingly.
     * @param {String} name the name of the user whose feedback is being shown (e.g. "host" or "participant")
     */
    set userName(name) {
        let nameLow = name.toLowerCase();
        let mName = name;
        if (nameLow === "host") {
            mName = "The host"
        } else if (nameLow === "participant") {
            mName = "The participant"
        }
        this.header.textContent = name;
        this.messages = {
            "disabled": `<h1>${mName} doesn't<br/>currently have<br/>eye gaze enabled!</h1>`,
            "inactive": `<h1>${mName} isn't currently<br/>active in the session!</h1>`,
            "nodata": `<h1>We can't detect ${mName}'s face right now!</h1>`,
        }
    }

    /**
     * Gets the width of the feedback display.
     * @return {Number} the width of the feedback display
     */
    get width(){
        return this.size;
    }

    /**
     * Gets the height of the feedback display.
     * @return {Number} the height of the feedback display
     */
    get height(){
        return this.size / this.aspect;
    }

    /** 
     * Sets the aspect ratio of the feedback display (width/height) and updates the display accordingly.
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

    /** 
     * Sets the onion (i.e. the average face points over calibration) for the feedback display and updates the display accordingly.
     * @param {FaceLandmarks} facePoints 
     * */
    set onion(facePoints) {
        if (facePoints instanceof FaceLandmarks) {
            this._onion = facePoints;
        }
    }

    /**
     * Gets the onion (i.e. the average face points over calibration) for the feedback display.
     * @return {FaceLandmarks}
     */
    get onion() {
        return this._onion;
    }

    /** 
     * Sets the current face points for the feedback display and updates the display accordingly.
     * @param {FaceLandmarks} facePoints 
     * */
    set facePoints(facePoints) {
        if (facePoints instanceof FaceLandmarks) {
            this.points = facePoints;
            this.aspect = facePoints.aspect;
        }
    }

    /**
     * Toggles whether to render only the eyes or the whole face in the feedback display and updates the display accordingly.
     * @param {boolean} bool whether to render only the eyes or the whole face
     */
    set renderEyesOnly(bool) {
        this._renderEyesOnly = !!bool;
    }

    /**
     * Gets whether only the eyes or the whole face is rendered in the feedback display.
     * @return {boolean} whether only the eyes or the whole face is rendered in the feedback display
     */
    get renderEyesOnly() {
        return this._renderEyesOnly;
    }

    /**
     * Gets the appropriate face rendering function based on whether only the eyes or the whole face should be rendered.
     * @return {function} the appropriate face rendering function
     */
    get renderFace() {
        return this._renderEyesOnly ? this.renderFaceEyes : this.renderFaceAll;
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

        /** @type {GridLayout} */
        let grid = this.createChild(GridLayout, {}, 3, 4);

        [[this.closeButton, this.enableEyeGazeButton],
        [this.showUserButton, this.renderModeButton]] = grid.addGridIcons([
            [
                {
                    type: "action",
                    symbol: "close",
                    displayValue: "Exit",
                    events: {
                        "access-click": (e) => this.dispatchEvent(new AccessEvent("exit", e))
                    }
                }, 
                {
                    type: "adjective",
                    symbol: "eye",
                    displayValue: "Enable eye gaze",
                    events: {
                        "access-click": (e) => {
                            this.session.settings.toggleValue(`${this.shownUser}/eye-gaze-enabled`);
                        }
                    }
                }
            ],
            [
                {
                    type: "adjective",
                    symbol: "switch-user",
                    displayValue: "Host",
                    events: {
                        "access-click": (e) => {
                            this.shownUser = this.shownUser === this.sdata.me ? this.sdata.them : this.sdata.me;
                            sdata.set("shown-feedback-user", this.shownUser);
                        }
                    }
                },
                {
                    type: "adjective",
                    symbol: "show-eyes",
                    displayValue: "Show eyes",
                    events: {
                        "access-click": (e) => {
                            this.toggleRenderMode();
                            sdata.set("feedback-show-eyes-only", this.feedback.renderEyesOnly);
                        }
                    }
                }
            ],
            [
                {
                    type: "topic-starter",
                    symbol: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FvFWZT7iOGfm7aQkONjT7?alt=media&token=9c011d4c-fce7-4018-a7c9-8e19747a0555",
                    displayValue: "Calibration settings",
                    events: {
                        "access-click": (e) => {
                            session.settings.gotoPath(`home/${this.shownUser}/calibration`, false)
                            session.settings.openPageOnBack("eyeGaze");
                            e.waitFor(session.openWindow("settings"));
                        }
                    }
                },
                {
                    type: "topic-starter",
                    symbol: "https://firebasestorage.googleapis.com/v0/b/eyesee-d0a42.appspot.com/o/icons%2Fall%2FVKtlw1GP6XQq0518M3C1?alt=media&token=1d403d43-ee1b-429f-8292-8aa8b9460be6",
                    displayValue: "Access settings",
                    events: {
                        "access-click": (e) => {
                            session.settings.gotoPath(`home/${this.shownUser}/access`, false)
                            session.settings.openPageOnBack("eyeGaze");
                            e.waitFor(session.openWindow("settings"));
                        }
                    }
                }
            ]
        ], 0, 0)
       
        this.feedback = grid.add(new FeedbackFrame(), [0,1], [2,3]);

        [this.calibrateButton, this.testButton] = grid.addGridIcons([
            {
                type: "noun",
                symbol: "calibrate",
                displayValue: "Calibrate",
                events: {
                    "access-click": (e) =>this.dispatchEvent(new AccessEvent("calibrate-"+this.shownUser, e))
                } 
            },
            {
                type: "emphasis",
                symbol: "test",
                displayValue: "Test",
                events: {
                    "access-click": (e) => this.dispatchEvent(new AccessEvent("test-"+this.shownUser, e))
                }   
            }
        ], 2, 2)
    }
        
    

    toggleRenderMode(bool) {
        if (typeof bool !== "boolean") {
            bool = !this.feedback.renderEyesOnly;
        }
        this.feedback.renderEyesOnly = bool;
        this.renderModeButton.symbol = bool ? "show-face" : "show-eyes";
        this.renderModeButton.displayValue = bool ? "Show face" : "Show eyes";
    }

    /** Sets the onion for the current user and sends it to the other peer
     * @param {FaceLandmarks} onion 
     * */
    setOnion(onion) {
        const {sdata} = this
        this[sdata.me + "Onion"] = onion;
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
        
        this.dispatchEvent(new Event("close"));
        await this.hide(400);

        // set face points to null so that feedback disappears
        this._setUsersFacePoints(null, this.shownUser);
    }

   
    async initialise(){
        const {sdata, session} = this

        addProcessListener(this._onProcess.bind(this));
        
        session.videoCall.addEventListener("facepoints", ({data}) => this._setUsersFacePoints(sdata.them, data));
 
        this.hostName = session.settings.get("host/profileSettings/name") || "Host";
        this.participantName = session.settings.get("participant/profileSettings/name") || "Participant";

        session.settings.addEventListener("change", (e) => {
            if (e.path.endsWith("eye-gaze-enabled")) {
                this._updateUsersStatus(e.path.split("/")[0]);
            } else if (e.path.endsWith("profileSettings/name")) {
                let user = e.path.split("/")[0];
                this._updateUsersName(user, e.value || (user === "host" ? "Host" : "Participant"));
            }
        })


        sdata.onUser("joined", this._updateUsersStatus.bind(this))
        sdata.onUser("left",  this._updateUsersStatus.bind(this))


        sdata.onValue(`onion/${sdata.them}`, str => this._updateUsersOnion(sdata.them, str))
        sdata.onValue(`onion/${sdata.me}`, str => this._updateUsersOnion(sdata.me, str))
        sdata.onValue("feedback-show-eyes-only", val => this.toggleRenderMode(!!val));
        sdata.onValue("shown-feedback-user", user => this.shownUser = user)
    }

    /**
     * Sets which user's feedback to show and updates the display accordingly
     * @param {"host"|"participant"} user
     */
    setShownUser(user) {
        user = user === "host" ? "host" : "participant";
        this.sdata.set("shown-feedback-user", user);
    }


    /** Sets which user's feedback to show
     * @param {"host"|"participant"} user
     */
    set shownUser(user) {
        let shownUser = user === "host" ? "host" : "participant";
        this._shownUser = shownUser;
        
        this._updateUsersName();
        this._updateUsersOnion();
        this._updateUsersStatus();
        this._setUsersFacePoints(shownUser, null);
    }

    /**
     * @return {"host"|"participant"} user which feedback is currently shown
     */
    get shownUser() {
        return this._shownUser;
    }   


   
    /**
     * Sets whether the feedback is disabled (e.g. because eye gaze isn't enabled or because
     * face points are invalid) and updates the display and buttons accordingly
     * @param {(boolean|"nodata"|"disabled"|"inactive")} bool if boolean, whether feedback is disabled or not. 
     * 
     */
    set disabled(bool) {
        if (bool !== this._disabled) {
            this.feedback.disabled = bool;
            this._disabled = bool;
            this.renderModeButton.disabled = bool && bool !== "invalid";
    
            this.calibrateButton.disabled = bool;
            this.testButton.disabled = bool;
            this.enableEyeGazeButton.symbol = bool == "disabled" ? "noeye" : "eye";
            this.enableEyeGazeButton.displayValue = bool == "disabled" ? "Eye-gaze Disabled" : "Eye-gaze Enabled";
    
            if (!bool) {
                clearTimeout(this._noDataTimeout);
                this._noDataTimeout = setTimeout(() => {
                    this._setUsersFacePoints(this.shownUser, null);
                }, MaxTimeTillFade);
            }
        }
    }

    get disabled() {
        return this._disabled;
    }
    
   
    
    /**
     * Updates the onion for a user and updates the feedback display if the shown user's onion has changed
     * @param {"host"|"participant"} user
     * @param {FaceLandmarks|string|null} onion
     */
     _updateUsersOnion(user, onion) {
        if (typeof user === "string") {
            if (typeof onion === "string") {
                onion = FaceLandmarks.deserialise(onion, used_points);
            }
            this[user + "Onion"] = onion;
        }

        if (typeof user !== "string" || user === this.shownUser) {
            this.feedback.onion = this[this.shownUser + "Onion"] || null;
        }
    }

    /**
     * Updates the status of a user (whether they have eye gaze enabled and whether they
     * are active in the session) and updates the feedback display accordingly
     * @param {"host"|"participant"} user
     */
    _updateUsersStatus(user) {
        if (typeof user !== "string" || user === this.shownUser) {
            if (!this.session.settings.get(this.shownUser + "/eye-gaze-enabled")) {
                this.disabled = "disabled";
            } else if (!this.sdata.isUserActive(this.shownUser)) {
                this.disabled = "inactive";
            } else {
                this.disabled = false;
            }
        }
    }
     
    /**
     * Updates the displayed name for a user and updates the display if the shown user's name has changed
      * @param {"host"|"participant"} user
      * @param {String} value the new name to set for the user
     */
    _updateUsersName(user, value) {
        if (typeof user === "string" && typeof str === "string") {
            this[user + "Name"] = value;
        }
        
        if (typeof user !== "string" || user === this.shownUser) {
            this.feedback.userName = this[this.shownUser + "Name"];
            this.showUserButton.displayValue = this[this.shownUser + "Name"];
        }
    }

  
    /** @param {{points: FaceLandmarks?}} data*/
    _onProcess(data) {
        const {sdata} = this;
        if (this.isOpen && this.shownUser === sdata.me) {
            let points = null;

            // If data contains face points, serialise them and send to other peer
            if (data.points instanceof FaceLandmarks) {
                points = data.points;
                const str = points.serialise(used_points);
                this.session.videoCall.sendData("facepoints", str);
            }

            // Set face points for current user
            this._setUsersFacePoints(sdata.me, points);
        }
    }

    /**
     * Sets the face points for a user and updates the feedback display accordingly
     * @param {"host"|"participant"} user
     * @param {FaceLandmarks|string|null} facePoints
     */
    _setUsersFacePoints(user, facePoints) {
        if (user === this.shownUser) {

            // Deserialise if facePoints is a string
            if (typeof facePoints === "string") {
                facePoints = FaceLandmarks.deserialise(facePoints, used_points);
            }

            // Check if face points are valid
            const invalid = !(facePoints instanceof FaceLandmarks) || facePoints.width == 0;
            if (invalid) {
                // If invalid, show feedback as disabled and stop rendering
                this.feedback.stop();
                this._updateUsersStatus();
                this.disabled = this.disabled || "nondata";
            } else {
                // If not invalid, show feedback and render face points
                this.feedback.start();
                this.feedback.facePoints = facePoints.width == 0 ? null : facePoints; 
                 
                if (facePoints.isOutside) {
                    this.disabled = "invalid";
                } else if (this.disabled !== "disabled") {
                    this.disabled = false;
                }


                clearTimeout(this._noDataTimeout);
                this._noDataTimeout = setTimeout(() => {
                    this._setUsersFacePoints(this.shownUser, null);
                }, MaxTimeTillFade);
            }
        }
    }
   

    static get fixToolBarWhenOpen() {return true}
    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta), GridIcon.styleSheet]
    }
}

