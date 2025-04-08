import { createFeatureProxy } from "./Features/features-interface.js";
import { FirebaseFrame } from "./Firebase/firebase-frame.js";
import * as FB from "./Firebase/firebase.js";
import { ERROR_CODES, SessionConnection } from "./Firebase/session-connection.js";
import { SvgPlus, Vector } from "./SvgPlus/4.js";
import { ShadowElement } from "./Utilities/shadow-element.js";
import { delay, getQueryKey, PublicProxy, WaveStateVariable } from "./Utilities/usefull-funcs.js";

/** @param {() => Promise[]} */
async function series(arr) {

    for (let promise of arr) {
        await promise();
    }
}
const parallel = (...args) => Promise.all(...args);


/** @typedef {import('./SessionView/session-view.js').SessionView} SessionView*/
/** @typedef {import('./Features/ToolBar/tool-bar.js').ToolBarFeature} ToolBarFeature*/
/** @typedef {import('./Features/Cursors/cursors.js').Cursors} Cursors*/
/** @typedef {import('./Features/features-interface.js').Features} Feature*/
/** @typedef {import('./Features/EyeGaze/eye-gaze.js').EyeGazeFeature} EyeGazeFeature*/
/** @typedef {import('./Features/Notifications/notifications.js').Notifications} Notifications*/
/** @typedef {import('./Features/AccessControl/access-control.js').AccessControl} AccessControl*/
/** @typedef {import('./Features/features-library.js')} FLIBMod*/
/** @typedef {import('./Features/features-interface.js').Features} Feature*/


let instanceCount = 0;

/** @type {SessionConnection} */
let sessionConnection = null;

/** @type {SessionView} */
let SessionView;

/** @type {FLIBMod} */
let Features;

const $$ = new WeakMap();

// async function loadResources() {
//     console.log("loading resources");
    
//     let a = async () => {
        
//     }
//     let b = async () => {
//         
//         await Features.loadResources();
//     }

//     await parallel([a(), b()]);
// }

const LoadState = {}
function logState(){
    let sum = Object.values(LoadState).reduce((a,b)=>a+b)/20;
    let maxstr = Math.max(...Object.keys(LoadState).map(a=>a.length));
    let hue = sum * 97;
    let str = `%c LOAD STATE ${Math.round(sum*100)}%\n\t` +Object.keys(LoadState).map(k => `${k.padStart(maxstr)}: ${"".padStart((LoadState[k]+1)*3, LoadState[k]==2?"-":"~")}`).join("\n\t");
        console.log(str, `background:hsl(${hue}deg, 100%, 90%); color:hsl(${hue}deg, 100%, 30%)`);
}
function setLoadState(str, state) {

    LoadState[str] = state;
    logState();
}

async function initialiseFirebaseUser(){
    setLoadState("firebase", 0);
    return new Promise((r) => {
        FB.addAuthChangeListener((user) => {
            if (user == null) {
                FB.signInAnonymously();
            } else {
                setLoadState("firebase", 2);
                r()
            }
        })
        FB.initialise();
    })
}

class FeatureInitialiserError extends Error {
    constructor(feature, e) {
        super(feature.__proto__.constructor.name + '.initialise()\n\t' + e.message)
    }
}

export class SessionDataFrame extends FirebaseFrame {
    constructor(firebaseName) {
        if (sessionConnection == null || !sessionConnection.hasJoined) {
            throw "Session not connected";
        }
        super(`session-data/${sessionConnection.sid}/${firebaseName}`);
    }

    get isHost(){
        if (sessionConnection == null) {
            return null
        } else {
            return sessionConnection.isHost;
        }
    }

    get sid(){
        if (sessionConnection == null) {
            return null
        } else {
            return sessionConnection.sid;
        }
    }
}

export class SquidlySessionElement extends ShadowElement {
    /** @type {SessionView} */
    sessionView = null;

    /** @type {ToolBarFeature} */
    toolBar = null;

    /** @type {AccessControl} */
    accessControl = null;

    /** @type {Notifications} */
    notifications = null;

    /** @type {number} */
    sharedAspectRatio = 1;




    constructor(el) {
        if (instanceCount !== 0) {
            throw "There can only be one instance of the squidly session element per document"
        }
        instanceCount ++;
        super(el, "squidly-session-root")
        this.squidlySession = new SquidlySession(this);
        window.session = this.squidlySession;
    }

    async initialiseSessionView(){
        setLoadState("sessionView", 0);
        SessionView = (await import("./SessionView/session-view.js")).SessionView;
        setLoadState("sessionView", 1);
        await SessionView.loadStyleSheets();

        // Create session view 
        this.sessionView = this.createChild(SessionView, {styles: {
            position: "absolute",
            top: "0",
            left: "0",
            bottom: "0",
            right: "0",
            width: "100%",
            height: "100%,",
            "z-index": 1,
            overflow: "hidden"
        }});
        
        window.sv = this.sessionView
        setLoadState("sessionView", 2);
    }

    async initialiseFeatures() {
        Features = (await import("./Features/features-library.js"))

        await Promise.all(Features.FEATURES.map(async f => {
            setLoadState(f.name, 0);
            await f.class.loadResources()
            setLoadState(f.name, 1);
        }))

        let makeFeature = (featureInfo) => {
            let {firebaseName} = featureInfo.class;
            let sDataFrame = new SessionDataFrame(firebaseName);

            /** @type {Feature} */
            let feature = new featureInfo.class(this.squidlySession, sDataFrame);

            // Attach feature elements to their corresponding areas on the session view.
            if (typeof featureInfo.layers === "object" && featureInfo.layers !== null) {
                for (let key in featureInfo.layers) {
                    let layer = featureInfo.layers[key]
                    let func = layer.type == "panel" ? "setPanelContent" : "addScreenArea";
    
                    let element = feature[key];
                    if (!element) {
                        console.warn(`The feature element "${key}" is missing`)
                    } else if (!SvgPlus.is(element, ShadowElement)) {
                        console.warn(`The feature element "${key}" is not a shadow element.`)
                    } else {
                        let res = this.sessionView[func](layer.area, element);
                        if (layer.index) {
                            res.styles = {"z-index": layer.index}
                        }
                    }
                }
            }

            this[featureInfo.name + "Public"] = createFeatureProxy(feature, featureInfo);
            this[featureInfo.name] = feature;

            return [feature, featureInfo];
        }

        // Instantiate all features.
        let features = Features.FEATURES.map(makeFeature);

        // Initialise all features.
        await Promise.all(features.map(async ([feature, info]) => {
            try { 
                await feature.initialise() 
                setLoadState(info.name, 2);
            } catch (e) {
                throw new FeatureInitialiserError(feature, e)
            }
        }));
    }

    async initialiseSessionConnection(){
        let error = [false, ""];
        setLoadState("connection", 0)
        if (sessionConnection === null) {
            let key = getQueryKey();
            if (key == null) {
                error = [ERROR_CODES.NO_SESSION, "no key provided"];
            } else {
                sessionConnection = new SessionConnection(key.key);
            }
        }
        
        if (error[0] === false && sessionConnection !== null) {
            error = await sessionConnection.join();
        }
        
       let [code] = error;
        if (code !== false) {
            switch (code) {
                case ERROR_CODES.NO_SESSION:
                    this.loaderText = `The session you are trying to connect no longer exists.`
                    break;
                case ERROR_CODES.PERMISSIONS:
                    this.loaderText = `You do not currently have access to start this session.</br>
                     please check your licence is still valid.`
                    break;
                case ERROR_CODES.SESSION_NOT_STARTED:
                    this.loaderText = `The session has not been started, please wait for the </br>
                    host to start the session.`
                    await sessionConnection.waitForStart();
                    this.initialiseSessionConnection();
                    break;
                case ERROR_CODES.WAITING_APPROVAL: 
                    this.loaderText = `The host has not yet granted you approval to join. </br> Please wait for the host to approve your request.`
                    await sessionConnection.waitForApproval();
                    this.initialiseSessionConnection();
                    break;
                case ERROR_CODES.IN_SESSION:
                    this.loaderText = `You are currently in another session please end this session before joining a new session.`
                    await sessionConnection.waitForApproval();
                    break;
                default:
                    console.log(error);
                    this.loaderText = `An unexpected error occured please refresh and try again. </br> ${error}`
            }
        } else {
            setLoadState("connection", 2);
        }
    }

    async onconnect(){
        await parallel([
            // Load resources -> initialise session view
            this.initialiseSessionView(),

            // Initialise firebase -> Connect to FB session
            series([initialiseFirebaseUser,  this.initialiseSessionConnection.bind(this)])   
        ]);

        
        if (sessionConnection !== null && sessionConnection.hasJoined) {
            try {
                await Promise.all([
                    this.initialiseFeatures(),
                    this.initialiseFixedAspect()
                ]);
                this.squidlyLoader.hide(0.5);
            } catch (e) {
                console.log(e);
                
                this.loaderText = e+"";
            }
        } else {

        }

        // await Promise.all([
            // TODO: Setup WebRTC
        // ])



    }

    async initialiseFixedAspect(){
        let blank = new ShadowElement("dummy-element");
        let sdata = new SessionDataFrame("shared-aspect-ratio");
        
        // Watch for resize changes in the full aspect area
        let observer = new ResizeObserver(() => {
            // If the size changes broadcast the new size to the 
            // database
            let me = sessionConnection.isHost ? "host" : "participant";
            let size = blank.bbox[1];
            sdata.set(me, {x: size.x, y: size.y});
        })
        observer.observe(blank);

        sdata.onValue(null, (val) => {
            if (val !== null) {
                let size = null;
                if ("participant" in val) {
                    size = new Vector(val.participant);
                } else if ("host" in val) {
                    size = new Vector(val.host);
                }

                if (size !== null) {
                    let aspect = 1;
                    if (size.x > 1e-3 && size.y > 1e-3) {
                        aspect = size.x / size.y
                    }
                    this.sharedAspectRatio = aspect;
                    this.sessionView.styles = {
                        "--aspect-ratio": aspect
                    }
                }
            }
        })

        let area = this.sessionView.addScreenArea("fullAspectArea", blank);
        area.styles = {"z-index": -1};
    }

    async testFR() {
        
        for (let j = 0; j < 100; j++) {
            let avg = 0;
            for (let i = 0; i < 10; i++) {
                let t0 = performance.now();
                await delay();
                avg += performance.now() - t0;
            }
    
            console.log(10000 / avg);
        }
        
    }

    testin(){
        // this.testFR()

        this.toolBar.addEventListener("icon-selection", async (e) => {
            if (e.icon.key == "audio") {
                e.icon.name = e.icon.name == "mute" ? "unmute" : "mute";
                e.preventDefault();
            }else if (e.icon.key == "video") {
                e.icon.name = e.icon.name == "video" ? "novideo" : "video";
                e.preventDefault();
            } else if (e.icon.key == "screen") {
                e.preventDefault();
                await this.toolBar.toggleRingBar(false);
                this.toolBar.setIcon("share/trash/hidden", false);
                this.toolBar.setIcon("share/notification", "1");
                e.icon.notification = "1";
            } else if (e.icon.key == "trash") {
                await this.toolBar.toggleRingBar(false);
                e.icon.hidden = true;
                this.toolBar.setIcon("share/screen/notification", null);
                this.toolBar.setIcon("share/notification", null);
            } else if (e.icon.key == "settings") {
                this.sessionView.toggle("sideScreen")
            } else if (e.icon.key == "end") {
                sessionConnection.leave();
            }
        })
    }

    get squidlyLoader(){
        return document.querySelector("squidly-loader")
    }
    
    /** @param {String} text */
    set loaderText(text) {
        if (this.squidlyLoader) {
            if (!this._loaderTextEl) {
                let text = new SvgPlus("div");
                text.styles = {
                    "border-radius": "0.5em",
                    padding: "0.5em",
                    color: "white",
                    background: "#8F53C9",
                    width: "70%",
                    "font-size": "1.5em",
                    "text-align": "center",
                    position: "absolute",
                    top: "calc(50% + 20vmin + 1.5em)",
                    left: "50%",
                    transform: "translate(-50%, -50%)"
                }            
           
                    
                
                this.squidlyLoader.appendChild(text);
                this._loaderTextEl = text;
            }
            this._loaderTextEl.innerHTML = text
        }
    }
  
    /** 
     * @param {import("./SessionView/session-view.js").HideableElement} name
     * @param {boolean} isShown 
     * */
    async togglePanel(name, isShown) {
        await this.sessionView.show(name, isShown);
    }
}

export class SquidlySession {
    constructor(sessionElement) {
        $$.set(this, sessionElement);
    }

    /** @return {number} */
    get sharedAspectRatio(){
        return $$.get(this).sharedAspectRatio;
    }

     /** @return {?EyeGazeFeature} */
     get eyeGaze(){
        return $$.get(this).eyeGazePublic;
    }

    /** @return {?ToolBarFeature} */
    get toolBar(){
        return $$.get(this).toolBarPublic;
    }

    /** @return {?AccessControl} */
    get accessControl(){
        return $$.get(this).accessControlPublic;
    }

     /** @return {?Cursors} */
     get cursors(){
        return $$.get(this).cursorsPublic;
    }

    /** @return {?Notifications} */
    get notifications(){
        return $$.get(this).notificationsPublic;
    }

    /** @return {boolean} */
    get isHost(){
        return sessionConnection.isHost;
    }


    /**
     * @param {boolean} bool
     */
    async toggleLoader(bool){
        await $$.get(this).toggleLoader(bool)
    }

    /** 
     * @param {import("./SessionView/session-view.js").HideableElement} name
     * @param {boolean} isShown 
     * */
    async togglePanel(name, isShown) {
        await $$.get(this).togglePanel(name, isShown);
    }
}

SvgPlus.defineHTMLElement(SquidlySessionElement)
