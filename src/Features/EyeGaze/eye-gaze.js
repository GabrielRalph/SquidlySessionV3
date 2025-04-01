import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton } from "../../Utilities/access-buttons.js";
import { HideShow } from "../../Utilities/hide-show.js";
// import { AccessButton, AccessClickEvent } from "../../Utilities/access-buttons.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { SvgResize } from "../../Utilities/svg-resize.js";
import { relURL, isExactSame } from "../../Utilities/usefull-funcs.js";
import { addProcessListener, getStream, isOn, isProcessing, startProcessing, startWebcam, stopProcessing } from "../../Utilities/webcam.js";
import { Features } from "../features-interface.js";
import { FaceLandmarks, load } from "./Algorithm/Utils/face-mesh.js";
import { CalibrationFrame } from "./calibration-frame.js";
import { FeedbackFrame } from "./feedback-frame.js";


class FeedbackWidget extends SvgPlus {
    constructor(){
        super("feedback-widget");

        this.fb = this.createChild(FeedbackFrame);
        let row = this.createChild("div");
        let b1 = row.createChild(AccessButton, {events: {
            "access-click": (e) => {
               this.dispatchEvent(new Event("calibrate", {bubbles: true}))
            }   
        }}, "calibrate");
        b1.createChild(Icon, {}, "calibrate")
        b1.createChild("div", {content: "Calibrate"})

        let b2 = row.createChild(AccessButton, {
            class: "test",
            events: {
                "access-click": (e) => {
                   this.dispatchEvent(new Event("test", {bubbles: true}))
                }   
           }
        }, "calibrate");
        b2.createChild(Icon, {}, "test")
        b2.createChild("div", {content: "Test"})
    }
}

class FeedbackWindow extends ShadowElement {
    /**@type {HideShow} */
    // root = null;

    /**@type {FeedbackFrame} */
    feedback1 = null;

    /**@type {FeedbackFrame} */
    feedback2 = null;

    /**@type {CalibrationFrame} */
    main = null; 
    constructor() {
        let root = new HideShow("feedback-window");
        root.applyShownState = () => {
            root.styles = {
                "pointer-events": "all",
                "opacity": 1,
            }
        }
        super("feedback-window", root);

        let head = this.createChild("div", {class: "header"});
        head.createChild("h1", {content: "Get in to view to </br> start the calibration"});
        let b = head.createChild(AccessButton, {
            events: {
                "access-click": () => this.dispatchEvent(new Event("exit"))
            }
        }, "calibrate")
        b.createChild(Icon, {}, "close");
        b.createChild("div", {content: "Exit"})


        let main = this.createChild("div", {class: "main"});

        this.feedback1 = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new Event("calibrate1")),
            "test": (e) => this.dispatchEvent(new Event("test1"))
        }});
        this.feedback2 = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new Event("calibrate2")),
            "test": (e) => this.dispatchEvent(new Event("test2"))
        }});
    }

    setData(data, findx = 1) {
        let key = "feedback"+findx
        // console.log(data.points instanceof FaceLandmarks);
        
        if (typeof data !== "object" || data == null) {
            this[key].toggleAttribute("hide", true);
        } else {
            this[key].toggleAttribute("hide", false);
            if (!(data.points instanceof FaceLandmarks)) {
                this[key].toggleAttribute("invalid", true);
            } else {
                this[key].toggleAttribute("invalid", false)
                this[key].fb.data = data; 
            }
            
        }
    }

    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta)]
    }
}

class CalibrationScreenArea extends ShadowElement {
   constructor(){
        super("calibration-window");
        this.calibrationFrame = this.createChild(CalibrationFrame)
   }
}

class EyeGazePointers extends ShadowElement {
    constructor(){
        super("eyegaze-cursor");
        let svgResize = this.createChild(SvgResize, {
        });
        this.pointer1 = svgResize.createPointer("blob", 30);
        this.pointer2 = svgResize.createPointer("blob", 30);
        svgResize.shown = true;
        svgResize.start();
    }

    setEyeData(data, user) {
        if (data !== null) {
            let pointer = this["pointer"+user];
            if (data.result instanceof Vector) {
                pointer.show();
                pointer.position = data.result
            } else {
                pointer.hide();
            }
        }
    }
 }

const MODES = {
    feedback: 1,
    calibration: 2,
    calibrated: 3,
    uncalibrated: 4,
}


const used_points = [...new Set([152,10,389,162,473,468,33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7,362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382,61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109])]
// console.log(used_points.length * 2 * 3+ 2 );
const prec_v = 1e4;
const prec_d = 10;
const total = 478;
function serialiseFaceMeshData(data) {
    let {points, width, height} = data;
    let pointsFlat = used_points.flatMap((i) => [points[i].x,points[i].y,points[i].z].map(v => Math.round(v * prec_v)));
    let u16 = new Int16Array(pointsFlat.length + 2);
    u16[0] = Math.round(width/prec_d);
    u16[1] = Math.round(height/prec_d);
    pointsFlat.forEach((e, i) => {
        u16[i+2] = e;
    });
    let u8 = new Uint8Array(u16.buffer);
    let str = "";
    for (let i = 0; i < u8.length; i++) {
        str += String.fromCharCode(u8[i]);
    }

    return str;
}

function deserialiseFaceMeshData(str) {
    let data = null;
    if (typeof str === "string") {
        let u8 = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++){
            u8[i] = str.charCodeAt(i);
        } 
    
        let u16 = new Int16Array(u8.buffer);
        let width = u16[0]/prec_d;
        let height = u16[1]/prec_d;
    
        let points = new Array(478);
        for (let i = 0; i < used_points.length; i++) {
            points[used_points[i]] = {
                x: u16[i*3+2]/prec_v,
                y: u16[i*3+3]/prec_v,
                z: u16[i*3+4]/prec_v,
            }
        }
    
        data = {points, width, height};
    }
    
    return data;
}

export class EyeGazeFeature extends Features {
    /**@type {CalibrationFrame} */
    calibrationFrame = null;

    /**@type {FeedbackWindow} */
    feedbackFrame = null;

    constructor(session, sdata) {
        super(session, sdata);

        this.feedbackWindow = new FeedbackWindow();
        this.feedbackWindow.events = {
            "exit": this.exitFeedback.bind(this),
            "calibrate1": () => this.startCalibration(),
            "calibrate2": () => this.startCalibration(true)
        }

        this.csa = new CalibrationScreenArea();
        this.calibrationFrame = this.csa.calibrationFrame;

        this.eyeGazePointers = new EyeGazePointers();
        
        this.session.toolBar.addEventListener("icon-selection", (e) => {
            if (e.icon.name == "calibrate") {
                this.showFeedback();
            }
        })

        this.feedbackWindow.ondblclick = () => stopProcessing();

    }

    exitFeedback(t){
        this.feedbackShown = false;
        this.sdata.set("feedback-open", false)
        this.session.toolBar.toggleToolBar(true);
        this.session.toolBar.toolbarFixed = false;
        this.session.accessControl.restartSwitching(true);
        this.feedbackWindow.root.hide();
        this.mode = 0;

    }

    async showFeedback(){
        this.feedbackShown = true;
        this.sdata.set("feedback-open", true)
        this.session.toolBar.toggleToolBar(false);
        this.session.toolBar.toolbarFixed = true;
        this.session.accessControl.restartSwitching(false);
        
        if (!isProcessing()) {
            startProcessing();
        }

        await this.feedbackWindow.root.show(400);
        this.mode = MODES.feedback
    }

    startCalibration(forOther) {
        let isHost = this.sdata.isHost;
        isHost = forOther ? !isHost : isHost;

        this.sdata.set(`calibrating/${isHost ? "host" : "participant"}`, true);
    }

    async calibrate(bool){
        if (bool) {
            console.log("calibrate");
            
            this.session.toolBar.toggleToolBar(false);
            this.session.toolBar.toolbarFixed = true;
            this.session.accessControl.endSwitching(true);
            let [validation] = await Promise.all([
                this.calibrationFrame.calibrate(),
                this.calibrationFrame.show()
            ]);
            console.log(validation);
            
            let me = this.sdata.isHost ? "host": "participant";
            this.sdata.set(`calibrating/${me}`, false)
            this.calibrationFrame.hide();
        }
    }

    onEyeData(data){
        if (data.result) {
            this.eyeGazePointers.setEyeData(data, 1)
        }
        
        switch (this.mode) {
            case MODES.feedback:
                // Set face mesh points to database 
                // let str = serialiseFaceMeshData(data);
                // console.log(str.length);
                
                // data = deserialiseFaceMeshData(str);
                let str = null;
                if ("points" in data) {
                    str = serialiseFaceMeshData(data);
                }
                this.sdata.set(`feedback/${this.sdata.isHost ? "host" : "participant"}`, str)


                // Update feedback frame
                this.feedbackWindow.setData(data, 1);

            break;


        }
    }

    onRemoteFaceMeshData(data) {
        if (data != null && this.mode === MODES.feedback) {
             // Update feedback frame
             this.feedbackWindow.setData(data, 2);
        }
    }

    getElements(){
        return [this.feedbackWindow, this.eyeGazePointers, this.csa];
    }

    async initialise(){
        await Promise.all([load(), FeedbackWindow.loadStyleSheets()])
        if (!await startWebcam()) {
            throw "Please allow webcam access"
        }

        addProcessListener(this.onEyeData.bind(this));

        let me = this.sdata.isHost ? "host": "participant";
        let them = this.sdata.isHost ? "participant": "host";
        await this.sdata.set(`calibrating/${me}`, false);
        this.sdata.onValue(`feedback/${them}`, (str) => {
            this.onRemoteFaceMeshData(deserialiseFaceMeshData(str));
        });
        this.sdata.onValue(`calibrating/${me}`, this.calibrate.bind(this));
        this.sdata.onValue(`feedback-open`, (val) => {
            if (val !== this.feedbackShown) {
                if (val) this.showFeedback();
                else this.exitFeedback();
            }
        });
    }

    static get firebaseName(){
        return "eye-gaze";
    }
}
