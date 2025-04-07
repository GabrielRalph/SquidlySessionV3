import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { stopProcessing } from "../../Utilities/webcam.js";
import { FaceLandmarks } from "./Algorithm/Utils/face-mesh.js";



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
        let {points, svg, width, height, aspect} = this;
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
            
            let op = typeof this.error === "number" ? this.error : points.faceFrameQualityMetric;
            
            if (this.avg) {
                html += this.renderFace(width, height, 1, this.avg)
            }
            html += this.renderFace(width, height, op, points)
            

            svg.innerHTML = html;
            if (this.parentElement) {
                let isHit = points.isOutside;
                this.parentElement.style.setProperty("--valid", op);
                this.parentElement.toggleAttribute("invalid", isHit);
            }
        }
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


    set data(data) {
        
        let {width, height, points, errorDistance, avg} = data;
        this.points = points;
        this.aspect = width / height;

        this.error = null;
        if (typeof errorDistance === "number") {
            let e = errorDistance * 4;
            if (e > 1) e = 1;
            this.error = 1 - e**0.5;
        }
        this.avg = avg;
        this.render();
    }

    
}

