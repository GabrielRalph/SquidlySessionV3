import { FirebaseFrame } from "./Firebase/firebase-frame.js";
import * as FB from "./Firebase/firebase.js";
import { ERROR_CODES, SessionConnection } from "./Firebase/session-connection.js";
import { SvgPlus } from "./SvgPlus/4.js";
import { ShadowElement } from "./Utilities/shadow-element.js";
import { delay, getQueryKey, WaveStateVariable } from "./Utilities/usefull-funcs.js";

/** @param {() => Promise[]} */
async function series(arr) {

    for (let promise of arr) {
        await promise();
    }
}
const parallel = (...args) => Promise.all(...args);


/** @typedef {import('./SessionView/session-view.js').SessionView} SessionView*/
/** @typedef {import('./Features/ToolBar/tool-bar.js').ToolBarFeature} ToolBarFeature*/
/** @typedef {import('./Features/EyeGaze/eye-gaze.js').EyeGazeFeature} EyeGazeFeature*/
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

async function loadResources() {
    console.log("loading resources");
    
    let a = async () => {
        SessionView = (await import("./SessionView/session-view.js")).SessionView
        await SessionView.loadStyleSheets();
    }
    let b = async () => {
        Features = (await import("./Features/features-library.js"))
        await Features.loadResources();
    }

    await parallel([a(), b()]);
}

async function initialiseFirebaseUser(){
    return new Promise((r) => {
        FB.addAuthChangeListener((user) => {
            if (user == null) {
                FB.signInAnonymously();
            } else {
                r()
            }
        })
        FB.initialise();
    })
    
}

export class SquidlySessionElement extends ShadowElement {
    /** @type {SessionView} */
    sessionView = null;

    /** @type {ToolBarFeature} */
    toolBar = null;

    /** @type {AccessControl} */
    accessControl = null;

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
        console.log("initialising session view");
        
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
    }

    async initialiseFeatures() {
        
        let makeFeature = (featureInfo) => {
            let {firebaseName} = featureInfo.class;
            let sDataFrame = new SessionDataFrame(firebaseName);

            /** @type {Feature} */
            let feature = new featureInfo.class(this.squidlySession, sDataFrame);

            let elements = feature.getElements();

            // Attach feature elements to their corresponding areas on the session view.
            for (let i = 0; i < featureInfo.layers.length; i++) {
                let layer = featureInfo.layers[i]
                let func = layer.type == "panel" ? "setPanelContent" : "addScreenArea";
                
                let res = this.sessionView[func](layer.area, elements[i]);

                if (layer.index) {
                    res.styles = {"z-index": layer.index}
                }
            }
            this[featureInfo.name] = feature;

            return feature;
        }

        // Instantiate all features.
        let features = Features.FEATURES.map(makeFeature);

        // Initialise all features.
        await Promise.all(features.map(feature => feature.initialise()));
    }

    async initialiseSessionConnection(){
        let error = false;
        if (sessionConnection === null) {
            let key = getQueryKey();
            if (key == null) {
                error = [ERROR_CODES.NO_SESSION, "no key provided"];
            } else {
                sessionConnection = new SessionConnection(key.key);
            }
        }
        
        if (error === false && sessionConnection !== null) {
            error = await sessionConnection.join();
        }
        
        if (error !== false) {
            switch (error) {
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
                    
                    this.loaderText = `An unexpected error occured please refresh and try again.`
            }
            console.log(error);
            
        }
    }

    async onconnect(){
        await parallel([
            // Load resources -> initialise session view
            series([loadResources,  this.initialiseSessionView.bind(this)]),
            // Initialise firebase -> Connect to FB session
            series([initialiseFirebaseUser,  this.initialiseSessionConnection.bind(this)])   
        ]);
        
        if (sessionConnection !== null && sessionConnection.hasJoined) {
            try {
                await this.initialiseFeatures()
                this.testin();
        
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

     /** @return {?EyeGazeFeature} */
     get eyeGaze(){
        return $$.get(this).eyeGaze;
    }

    /** @return {?ToolBarFeature} */
    get toolBar(){
        return $$.get(this).toolBar;
    }

    /** @return {?AccessControl} */
    get accessControl(){
        return $$.get(this).accessControl;
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
