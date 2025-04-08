import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton, AccessEvent } from "../../Utilities/access-buttons.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { SvgResize } from "../../Utilities/svg-resize.js";
import { relURL, isExactSame, dotGrid, argmin, TransitionVariable } from "../../Utilities/usefull-funcs.js";
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
                "access-click": (e) => this.dispatchEvent(new AccessEvent("exit", e))
            }
        }, "calibrate")
        b.createChild(Icon, {}, "close");
        b.createChild("div", {content: "Exit"})


        let main = this.createChild("div", {class: "main"});

        this.feedback1 = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new AccessEvent("calibrate1", e)),
            "test": (e) => this.dispatchEvent(new AccessEvent("test1", e))
        }});
        this.feedback2 = main.createChild(FeedbackWidget, { hide: true, events: {
            "calibrate": (e) => this.dispatchEvent(new AccessEvent("calibrate2", e)),
            "test": (e) => this.dispatchEvent(new AccessEvent("test2", e))
        }});
    }

    setData(data, findx = 1) {
        let key = "feedback"+findx
        
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

class TestScreen extends ShadowElement {
    dotSize = 0.08;
    constructor(){
        super("test-screen", new HideShow("test-screen"));
        this.root.applyShownState = () => {
            this.root.styles = {
                "pointer-events": "all",
                "opacity": 1,
            }
        }

        let svg = this.createChild(SvgResize, {});
        svg.shown = true;
        this.svg = svg;
        svg.addDrawable(this)

        let b = this.createChild(AccessButton, {
            events: {
                "access-click": () => this.dispatchEvent(new Event("close"))
            },
            class: "close",
        }, "test-close");
        b.createChild(Icon, {}, "close");
        b.createChild("div", {content: "Close"});
   }


   hide(){
        this.root.hide();
        this.svg.stop();
        this.shownUser = null;
   }

   async showFor(user) {
        this.shownUser = user;
        this.svg.start();
        await this.root.show();
   }

   setEyeData(pos, user) {
        if (this.shownUser == user) {
            this.eyePosition = pos;
        }
    }

    draw(){
        let {svg} = this;
        svg.innerHTML = "";
        let width = this.clientWidth;
        let height = this.clientHeight;
        let diag = Math.sqrt(width**2 + height**2);
        let dotSize = this.dotSize * diag;
        let mx = dotSize * 0.75;
        let my = dotSize * 0.75;
        
        let dots = dotGrid(3, new Vector(mx, my), new Vector(width -mx, my), new Vector(mx, height - my), new Vector(width - mx, height - my));
        let dFurthest = Math.max((width-2*mx)/3, (height-2*my)/3);
        let p;
        let iClosest = -1;
        if (this.eyePosition) {
            p = this.eyePosition.mul(width, height);
            iClosest =  argmin(dots.map(d => d.sub(p).norm()));
        }

        dots.forEach((pos, i) => {
            if (i != 7) {
                let dot = svg.createChild("g", {
                    class: "dot",
                    transform: `translate(${pos.x} ${pos.y})`,
                });

                dot.createChild("circle", { 
                    class: "big",
                    cx: 0,
                    cy: 0,
                    r: (dotSize/2),
                });
                dot.createChild("circle", { 
                    class: "small",
                    cx: 0,
                    cy: 0,
                    r: (dotSize/2) * 0.1,
                });

                if (i == iClosest) {
                    let dist = 1 - p.sub(pos).norm() / dFurthest;
                    if (dist < 0) dist = 0;

                    let r = ( 0.1 + 0.45 * dist) * dotSize / 2;
                    let stroke = dotSize * dist * 0.45;
                    dot.createChild("circle", { 
                        class: "proximity",
                        cx: 0,
                        cy: 0,
                        r: r,
                        "stroke-width": stroke,
                    });
                }
            }
        });
    }

    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta)]
    }
}

class RestAccessButton extends AccessButton {
    isPointInElement(p) {
        let [pos,size] = this.bbox;
        return p.y > pos.y; 
    }
}

class RestButton extends ShadowElement {
    constructor() {
        super("rest-button");
        this.button = this.createChild(RestAccessButton, {class: "rest", content: "Rest"})
    }
    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta)]
    }
}

const MODES = {
    feedback: 1,
    calibration: 2,
    calibrated: 3,
    uncalibrated: 4,
}


const used_points = [...new Set([152,10,389,162,473,468,33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7,362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382,61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109])]
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
        points = new FaceLandmarks(points);
    
        data = {points, width, height};
    }
    
    return data;
}

export class EyeGazeFeature extends Features {
    /**@type {CalibrationFrame} */
    calibrationFrame = null;

    /**@type {FeedbackWindow} */
    feedbackFrame = null;

    eyeDataListeners = new Set();

    eyeDataDisabled = false;

    constructor(session, sdata) {
        super(session, sdata);

        this.testScreen = new TestScreen();
        this.feedbackWindow = new FeedbackWindow();
        this.calibrationWindow = new CalibrationScreenArea();
        this.restButton = new RestButton();

        this.calibrationFrame = this.calibrationWindow.calibrationFrame;

        this.feedbackWindow.events = {
            "exit": this.closeCalibration.bind(this),
            "calibrate1": (e) => this.startCalibration(false, e),
            "calibrate2": (e) => this.startCalibration(true, e),
            "test1": (e) => this._showTestScreen(1, e),
            "test2": (e) => this._showTestScreen(2, e),
        }

        this.addEyeDataListener((p) => {
            if (this.eyeDataDisabled) p = null;
            this.testScreen.setEyeData(p, 1);

         })


        this.testScreen.events = {
            "close": this._closeTestScreen.bind(this),
        }
        
        this.session.toolBar.addSelectionListener("calibrate", (e) => {
            this.openCalibration(e);
        })
        this.session.toolBar.addSelectionListener("eye", (e) => {
            let bool = !this.eyeDataDisabled;
            this.disableEyeData(bool, e);
            this.sdata.set(`disabled/participant`, bool)
            this.sdata.set(`disabled/host`, bool)
        })

        this.restButton.button.addEventListener("access-click", (e) => {
            let bool = !this.eyeDataDisabled;
            this.disableEyeData(bool, e)
            

        })

        this.feedbackWindow.ondblclick = () => stopProcessing();

        this.restWatcher = new TransitionVariable(0, 1, (v) => {
            this.session.togglePanel("bottomPanel", v==1)
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    addEyeDataListener(cb) {
        if (cb instanceof Function) {
            this.eyeDataListeners.add(cb)
        }
    }

    disableEyeData(bool, e) {
        let me = this.sdata.isHost ? "host": "participant";
        if (bool != this.eyeDataDisabled) {
            this.eyeDataDisabled = bool
            this.sdata.set(`disabled/${me}`, bool)
        }
        // if (e instanceof AccessButton) {
        //     e.waitFor(p)
        // }
    }

    closeCalibration(e){
        this.feedbackShown = false;
        this.sdata.set("feedback-open", false)
        this.session.toolBar.toolbarFixed = false;

        let p = this.feedbackWindow.root.hide()

        if (e instanceof AccessEvent) {
            e.waitFor(p)
        }
        this.mode = 0;
    }

    async openCalibration(e){
        this.feedbackShown = true;
        this.sdata.set("feedback-open", true)
        let p1 = this.session.toolBar.toggleToolBar(false);
        this.session.toolBar.toolbarFixed = true;
        
        this.session.accessControl.restartSwitching(false);
        
        if (!isProcessing()) {
            startProcessing();
        }

        let proms = Promise.all([this.feedbackWindow.root.show(400), p1]);
        if (e instanceof Event) {
            await e.waitFor(proms)
        } else {
            await proms
        }
        this.mode = MODES.feedback
    }

    startCalibration(forOther, e) {
        let isHost = this.sdata.isHost;
        isHost = forOther ? !isHost : isHost;
        let p = this.sdata.set(`calibrating/${isHost ? "host" : "participant"}`, true);
        if (e instanceof AccessEvent) e.waitFor(p);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    

    _showTestScreen(user, e){
        this._testScreenShown = true;
        this.sdata.set("test-screen", true)
        let p = this.testScreen.showFor(user);
        this.session.cursors.updateReferenceArea("entireScreen");
        if (e instanceof AccessEvent) {
            e.waitFor(p);
        }
    }

    _closeTestScreen(e){
        this.sdata.set("test-screen", false)
        this._testScreenShown = false;
        this.session.cursors.updateReferenceArea("fullAspectArea");
        if (e instanceof AccessEvent)
            e.waitFor(this.testScreen.hide());
        else this.testScreen.hide();

    }

    _onRemoteFaceMeshData(data) {
        if (data != null && this.mode === MODES.feedback) {
             this.feedbackWindow.setData(data, 2);
        }
    }

    _onEyeData(data){
        // If there is a gaze position
        if (data.result) {
            
            let eyeP = data.result.clone();

            // Update all the eyeData listeners
            let bbox = this.calibrationFrame.bbox;

            // Update test screen eye data
            // this.testScreen.setEyeData(data, 1);

            // Update rest watcher
            this.restWatcher.set(eyeP.y > 1 ? 1 : 0)

            // Update the pointers
            let v = this.eyeDataDisabled ? null : eyeP.clone();
            if (v instanceof Vector) {
                v.x = v.x < 0 ? 0 : (v.x > 1 ? 1 : v.x);
                v.y = v.y < 0 ? 0 : (v.y > 1 ? 1 : v.y);
            }
            try {
                let me = this.sdata.isHost ? "host" : "participant";
                this.session.cursors.updateCursorPosition(me + "-eyes", v, bbox)
            } catch (e) {

            }
            // Update the eye data listeners
            for (let cb of this.eyeDataListeners) {
                let v = null;
                let b = null;
                if (!this.eyeDataDisabled || eyeP.y > 1) {
                    v = eyeP.clone()
                    b = [bbox[0].clone(), bbox[1].clone()]
                }
                try {
                    cb(v, bbox, this.eyeDataDisabled)
                } catch (e) {
                    console.error(e);
                }
            }
        }

        
        switch (this.mode) {
            case MODES.feedback:
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

    async _beginCalibrationSequence(bool){
        if (bool) {
            
            this.session.toolBar.toggleToolBar(false);
            this.session.toolBar.toolbarFixed = true;
            this.session.accessControl.endSwitching(true);
            let [validation] = await Promise.all([
                this.calibrationFrame.calibrate(),
                this.calibrationFrame.show()
            ]);

            let mse = null;
            if (validation?.validation?.mse) {
                mse = validation.validation.mse;
            }
            let me = this.sdata.isHost ? "host": "participant";
            await this.sdata.set(`validation/${me}`, mse);
            this.sdata.set(`calibrating/${me}`, false)
            await this.calibrationFrame.hide();
            if (mse) {  
                this.session.notifications.notify(`Calibration completed with score of ${Math.round((1 - 2 * mse) * 100)}%`, "success");
            }
        }
    }

    async initialise(){
        await Promise.all([load(), FeedbackWindow.loadStyleSheets()])
        if (!await startWebcam()) {
            throw "Please allow webcam access"
        }

        this.session.cursors.updateCursorProperties("host-eyes", {
            size: 50,
            class: "blob",
            text: "host"
        });
        this.session.cursors.updateCursorProperties("participant-eyes", {
            size: 50,
            class: "blob",
            text: "participant"
        })


        addProcessListener(this._onEyeData.bind(this));

        let me = this.sdata.isHost ? "host": "participant";
        let them = this.sdata.isHost ? "participant": "host";
        
        // feedback data from the other user
        this.sdata.onValue(`feedback/${them}`, (str) => {
            this._onRemoteFaceMeshData(deserialiseFaceMeshData(str));
        });


        this.sdata.onValue(`disabled/${me}`, (val) => {
            this.disableEyeData(val)
        });

        // Calibration states
        let init = true;
        await this.sdata.set(`calibrating/${me}`, false);
        this.sdata.onValue(`calibrating/${me}`, this._beginCalibrationSequence.bind(this));
        this.sdata.onValue(`calibrating/${them}`, async (val) => {
            if (!init) {
                if (val) {
                    this.session.notifications.notify(`The ${them} is calibrating`, "info");
                } else {
                    let val = await this.sdata.get(`validation/${them}`);
                    if (val) {
                        this.session.notifications.notify(`The ${them} has completed calibration with a score of ${Math.round((1 - 2 * val) * 100)}%`, "success");
                    }else {
                        this.session.notifications.notify(`The ${them} has cancelled calibration`, "error");
                    }
                }
            }
            init = false;
        });

        // Opening and closing the test window 
        this.sdata.onValue("test-screen", (val) => {
            if (val !== this._testScreenShown) {
                if  (val) this._showTestScreen()
                else this._closeTestScreen();
            }
        })

        // Opening and closing the calibration (feedback) window.
        this.sdata.onValue(`feedback-open`, (val) => {
            if (val !== this.feedbackShown) {
                if (val) this.openCalibration();
                else this.closeCalibration();
            }
        });
    }

    static get firebaseName(){
        return "eye-gaze";
    }
}
