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
import { FeedbackWindow } from "./feedback-frame.js";
import { addPointToHeatmaps, Heatmap } from "./heatmap.js";


class CalibrationScreenArea extends ShadowElement {
   constructor(){
        super("calibration-window");
        this.calibrationFrame = this.createChild(CalibrationFrame)
   }
}

function clampV(v, min, max) {
    return new Vector(
        v.x < min.x ? min.x : (v.x > max.x ? max.x : v.x),
        v.y < min.y ? min.y : (v.y > max.y ? max.y : v.y)
    );
}
function clampV0_1(v) {
    return clampV(v, new Vector(0, 0), new Vector(1, 1));
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
                "access-click": (e) => this.dispatchEvent(new AccessEvent("close", e))
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

    get disableSwitch() {return true}
}

class RestButton extends ShadowElement {
    constructor() {
        super("rest-button");
        this.button = this.createChild(RestAccessButton, {class: "rest", content: "rest"})
    }
    static get usedStyleSheets() {
        return [relURL("./styles.css", import.meta)]
    }
}


export class EyeGazeFeature extends Features {
    /**@type {CalibrationFrame} */
    calibrationFrame = null;

    /**@type {FeedbackWindow} */
    feedbackWindow = null;

    eyeDataListeners = new Set();

    eyeDataDisabled = false;

    constructor(session, sdata) {
        super(session, sdata);

        this.testScreen = new TestScreen();
        this.feedbackWindow = new FeedbackWindow(session, sdata);
        this.calibrationWindow = new CalibrationScreenArea();
        this.restButton = new RestButton();

        this.calibrationFrame = this.calibrationWindow.calibrationFrame;

        this.feedbackWindow.events = {
            "exit": (e) => e.waitFor(this.session.openWindow("default")),
            "calibrate-participant": (e) => this.startCalibration("participant", e),
            "calibrate-host": (e) => this.startCalibration("host", e),
            "test-participant": (e) => e.waitFor(this._showTestScreen("participant")),
            "test-host": (e) => e.waitFor(this._showTestScreen("host")),
            "open": () => this._openCloseFeedback(true),
            "close": () => this._openCloseFeedback(false)
        }

        this.addEyeDataListener((p) => {
            if (this.eyeDataDisabled) p = null;
            this.testScreen.setEyeData(p, this.me);
         })


        this.testScreen.events = {
            "close": (e) => e.waitFor(this._showTestScreen(null)),
        }
        
        this.session.toolBar.addSelectionListener("calibrate", (e) => {
            e.waitFor(this.session.openWindow("eyeGaze"));
        })

        this.session.toolBar.addSelectionListener("eye", (e) => {
            this.toggleEyeGazeProcess();
        });

        this.restButton.button.addEventListener("access-click", (e) => {
            let bool = !this.eyeDataDisabled;
            this.disableEyeData(bool, e);
        });

        this.restWatcher = new TransitionVariable(0, 1, (v) => {
            this.session.toggleRestBar(v==1);
        });

        // Add cursor eye data listener
        this.addEyeDataListener((eyeP, bbox, disabled) => {
            let key = (this.sdata.isHost ? "host" : "participant") + "-eyes";
            if (eyeP == null || disabled) {
                this.session.cursors.updateCursorPosition(key, null);
            } else {
                this.session.cursors.updateCursorPosition(key, clampV0_1(eyeP), bbox)
            }
        });

        // Add heatmap eye data listener
        this.addEyeDataListener((eyeP,bbox, disabled) => {
            // add point to heatmaps if the eye position is a Vector
            if (eyeP instanceof Vector && !disabled) {
                let v = clampV0_1(eyeP);
                addPointToHeatmaps(v.x, v.y, 1);
            }
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    addEyeDataListener(cb) {
        if (cb instanceof Function) {
            this.eyeDataListeners.add(cb);
        }
    }

    disableEyeData(bool, e) {
        let me = this.sdata.isHost ? "host": "participant";
        if (bool != this.eyeDataDisabled) {
            this.eyeDataDisabled = bool;
            this.sdata.set(`disabled/${me}`, bool);
        }
    }

    toggleEyeGazeProcess(bool) {
        console.log(`feedback: ${this._feedbackIsOpen ? "open" : "false"},\nme calibrating: ${this._calibrating == true},\nthey calibrating: ${this._areTheyCalibrating == true}`);
        
        if (!this._feedbackIsOpen && this._calibrating !== true && this._areTheyCalibrating !== true) {
            if (typeof bool !== "boolean") {
                bool = !this.isProcessing;
            }
            console.log("toggle eye gaze process", bool);
            
            this.sdata.set(`on/participant`, bool);
            this.sdata.set(`on/host`, bool);
        }
    }
    
    startCalibration(user, e) {
        let p = this.sdata.set(`calibrating/${user}`, true);
        if (e instanceof AccessEvent) e.waitFor(p);
    }
    
    get isProcessing() {
        return this.__isProcessing;
    }
    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    set _isProcessing(bool) {
        if (bool != this.__isProcessing) {
            if (bool) {
                startProcessing();
            } else {
                stopProcessing();
                this.restWatcher.set(false);
                this._onEyeData(null); // Clear eye data
            }
        }
        this.__isProcessing = bool;
    }

    _onToggleEyeGazeProcess(bool) {
        this.session.toolBar.setIcon("access/eye/name", bool ? "eye" : "noeye");
        this._isProcessing = bool;
    }   

    _openCloseFeedback(state){
        if (state) {
            this.toggleEyeGazeProcess(true);
        }
        this._feedbackIsOpen = state;
    }

    async _showTestScreen(user){
        if (this.testScreen.shownUser !== user) {
            if (user == null) {
                this.session.cursors.updateReferenceArea("fullAspectArea");
                this.testScreen.shownUser = null;
                await this.testScreen.hide();
            } else {
                this.session.cursors.updateReferenceArea("entireScreen");
                await this.testScreen.showFor(user);
            }
            this.sdata.set("test-screen", user)
        }
    }

    _onEyeData(data){
        let eyeP = null;
        let bbox = null;
        
        // If there is a gaze position and the user isn't calibrating
        if (typeof data === "object" && data != null && data.result && !this._calibrating) {
            eyeP = data.result.clone();

            // Get the bounding box of the calibration frame
            bbox = this.calibrationFrame.bbox;

            // Update rest watcher
            this.restWatcher.set(eyeP.y > 1 ? 1 : 0);

            // If the eye data is disabled and the y-coordinate is less than or equal to 1, set eyeP to null
            if (this.eyeDataDisabled && eyeP.y <= 1) {
                eyeP = null;
            }
        }

        this._callEyeDataListeners(eyeP, bbox);
    }

    _callEyeDataListeners(eyeP, bbox) {
        // Update the eye data listeners
        for (let cb of this.eyeDataListeners) {
            try {
                // If eyeP is a Vector, clone it to avoid mutation
                let v = eyeP instanceof Vector ? eyeP.clone() : null;

                // If bbox is an array, clone the vectors to avoid mutation
                let b = Array.isArray(bbox) ? [bbox[0].clone(), bbox[1].clone()] : null;

                // Call the callback with the eye position and bounding box
                cb(v, b, this.eyeDataDisabled)
            } catch (e) {
                // console.error(e);
            }
        }
    }

    async _beginCalibrationSequence(bool){
        if (this._calibrating) return;

        if (bool) {
            this._calibrating = true;
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
                let onion = validation.sampleStats.avg;
                this.session.notifications.notify(`Calibration completed with score of ${Math.round((1 - 2 * mse) * 100)}%`, "success");
                this.feedbackWindow.setOnion(onion);
            }

            this._calibrating = false;
        }
    }

    async initialise(){
        await Promise.all([load(), FeedbackWindow.loadStyleSheets(), this.calibrationFrame.loadGuides()])
        if (!await startWebcam()) {
            this.throwInitialisationError("Could not start webcam. Please check your camera permissions.");
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
        });

        this.session.settings.addEventListener("change", (e) => {
            let path = e.path.split("/");
            let [user, type, setting] = path;
            if (user == this.sdata.me && type == "calibration") {
                this.calibrationFrame[setting] = e.value;
            }
        });

        this.calibrationFrame.guide = this.session.settings.get(`${this.sdata.me}/calibration/guide`);
        this.calibrationFrame.size = this.session.settings.get(`${this.sdata.me}/calibration/size`);
        this.calibrationFrame.speed = this.session.settings.get(`${this.sdata.me}/calibration/speed`);

        addProcessListener(this._onEyeData.bind(this));

        await this.feedbackWindow.initialise();

        const {me, them} = this;
        this.session.cursors.addEventListener(them+"-eyes", (e) => {
            this.testScreen.setEyeData(e.screenPos, them);
        })
        
        this.sdata.onValue(`on/${me}`, (bool) => {
            this._onToggleEyeGazeProcess(bool);
        });

        this.sdata.onValue(`disabled/${me}`, (val) => {
            this.disableEyeData(val)
        });

        
        // Set calibrating state to null
        await this.sdata.set(`calibrating/${me}`, null);

        // On calibration state change, start the calibration sequence
        this.sdata.onValue(`calibrating/${me}`, this._beginCalibrationSequence.bind(this));

        let init = true;

        // Calibration state of the other user
        this.sdata.onValue(`calibrating/${them}`, async (isCalibrating) => {
            this._areTheyCalibrating = isCalibrating;

            // If it isn't the initial onValue call and isCalibrating is either true or false
            if (!init && isCalibrating !== null) {
                // The other user is calibrating
                if (isCalibrating === true) {
                    this.session.notifications.notify(`The ${them} is calibrating`, "info");
                
                // The other has finished calibrating
                } else {
                    // Check if there is validation data
                    let validationData = await this.sdata.get(`validation/${them}`);

                    // If there is validation data, notify the user of the score
                    if (validationData) {
                        this.session.notifications.notify(`The ${them} has completed calibration with a score of ${Math.round((1 - 2 * validationData) * 100)}%`, "success");
                    
                    // Otherwise, notify the user that the calibration was cancelled
                    }else {
                        this.session.notifications.notify(`The ${them} has cancelled calibration`, "error");
                    }
                }
            }
            init = false;
        });

        // Opening and closing the test window 
        this.sdata.onValue("test-screen", (val) => {
            this._showTestScreen(val);
        })
    }

    createHeatmap(resolution = 300, kernal = 30) {
        return new Heatmap(resolution, kernal);
    }

    get me() { return this.sdata.me } 
    get them() { return this.sdata.them }

    static get firebaseName(){
        return "eye-gaze";
    }
}
