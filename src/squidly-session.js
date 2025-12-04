import { createFeatureProxy, FeatureInitialiserError, OccupiableWindow } from "./Features/features-interface.js";
import { FirebaseFrame } from "./Firebase/firebase-frame.js";
import * as FB from "./Firebase/firebase.js";
import { ERROR_CODES, SessionConnection } from "./Firebase/session-connection.js";
import { SvgPlus, Vector } from "./SvgPlus/4.js";
import { FrameRateMonitor } from "./Utilities/frame-rate-monitor.js";
import { ShadowElement } from "./Utilities/shadow-element.js";
import { delay, getQueryKey, PublicProxy, WaveStateVariable } from "./Utilities/usefull-funcs.js";
import { get, ref } from "./Firebase/firebase.js";
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
/** @typedef {import('./Features/Settings/settings.js').SettingsFeature} SettingsFeature*/
/** @typedef {import('./Features/VideoCall/video-call.js').VideoCall} VideoCall*/
/** @typedef {import('./Features/Text2Speech/text2speech.js').Text2Speech} Text2Speech*/
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

const LoadState = {}
function logState(){
    let sum = Object.values(LoadState).reduce((a,b)=>a+b)/28;
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



export class SessionDataFrame extends FirebaseFrame {
    constructor(firebaseName) {
        if (sessionConnection == null || !sessionConnection.hasJoined) {
            throw "Session not connected";
        }
        super(`session-data/${sessionConnection.sid}/${firebaseName}`);

        this.getFirebaseName = () => firebaseName;
    }

    onUser(key, callback) {
        if (sessionConnection == null || !sessionConnection.hasJoined) {
            throw "Session not connected";
        }
        sessionConnection.addUserUpdateListener(key, callback);
    }

    isUserActive(key) {
        if (sessionConnection == null || !sessionConnection.hasJoined) {
            throw "Session not connected";
        }
        return sessionConnection.isActive(key);
    }

    /** Get session data frame referenced at a child path
     * @param {string} path
     * 
     * @return {SessionDataFrame?}
     */
    child(path) {
        if (typeof path == "string" && path.length > 0) {
            return new SessionDataFrame(this.getFirebaseName() + "/" + path)
        }
        return null;
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

    get hostUID(){
        if (sessionConnection == null) {
            return null;
        } else {
            return sessionConnection.hostUID;
        }
    }

    get iceServers(){
        if (sessionConnection == null) {
            return null;
        }
        return sessionConnection.iceServers;
    }

    get me() { return this.isHost ? "host": "participant" } 
    get them() { return this.isHost ? "participant": "host"; }
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

    /** @type {SettingsFeature} */
    settings = null;

     /** @type {EyeGazeFeature} */
    eyeGaze = null;

    /** @type {number} */
    sharedAspectRatio = 1;

    /** @type {SessionDataFrame} */
    sdata = null;

    /** @type {Object.<string, OccupiableWindow>} */
    occupiables = {};

    /** @type {string} */
    occupier = null

    /** @type {OccupiableWindow} */
    currentOccupier = null;

    constructor(el) {
        if (instanceCount !== 0) {
            throw "There can only be one instance of the squidly session element per document"
        }
        instanceCount ++;
        super(el, "squidly-session-root")
        this.squidlySession = new SquidlySession(this);
        window.session = this.squidlySession;
    }


    async onconnect(){
        await parallel([
            // Load resources -> initialise session view
            this.initialiseSessionView(),

            // Initialise firebase -> Connect to FB session
            series([initialiseFirebaseUser,  this.initialiseSessionConnection.bind(this)])   
        ]);
        
        window.sessionConnection = sessionConnection;
        if (sessionConnection !== null && sessionConnection.hasJoined) {
            this.sdata = new SessionDataFrame("session-main")
            try {
                await Promise.all([
                    this.initialiseFixedAspect(),
                    this.initialiseFeatures()
                ]);
                await this.initialiseWindowManager();
                await this.initialiseKeyboardShortcuts();
                this.squidlyLoader.hide(0.5);

                this.toolBar.addSelectionListener("end", (e) => {
                    sessionConnection.leave();
                })

                this.toolBar.addSelectionListener("key", async (e) => {
                    // Copy the key to clipboard
                    try {
                        let link = "https://squidly.com.au/V3/?" + sessionConnection.sid;
                        await navigator.clipboard.writeText(link)
                        this.notifications.notify("Session key copied to clipboard", "success");
                    } catch (e) {
                        this.notifications.notify("Failed to copy session key to clipboard", "error");
                    }
                })
            
            } catch (e) {
                
                
                if (e instanceof FeatureInitialiserError) {
                    this.loaderText = e.displayMessage;
                    this.loaderVideo = e.video;
                } else {
                    this.loaderText = "An unexpected error occurred while initialising the session. Please refresh and try again.";
                }
                console.log(e);
            }

            console.log(this.toolBar)
            
        } else {

        }
    }

    panelMode = "sidePanel"

    async openWindow(name){
        if (name != this.occupier) {
            let nextOccupier = name in this.occupiables ? this.occupiables[name] : null;
            name = name in this.occupiables ? name : null;

            let proms = [
                this.currentOccupier instanceof Element ? this.currentOccupier.close() : null,
                nextOccupier != null ? nextOccupier.open() : null,
                nextOccupier != null && nextOccupier.fixToolBarWhenOpen ? this.toolBar.toggleToolBar(false) : null,
                nextOccupier != null ? this.togglePanel(this.panelMode, true) : this.togglePanel(this.panelMode, false)
            ];
            this.toolBar.toolbarFixed = !!nextOccupier?.fixToolBarWhenOpen
            if (nextOccupier == null && this.accessControl.isSwitching) {
                this.toolBar.toolbarFixed = true;
                proms.push(this.togglePanel("toolBarArea", true));
            }
            this.occupier = name;
            this.currentOccupier = nextOccupier;
            this.sdata.set("occupier", name);
            await Promise.all(proms);
            
        }
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
        // this.createChild(FrameRateMonitor, {styles: {
        //     position: "absolute",
        //     top: "1em",
        //     right: "1em",
        //     "z-index": 3,
        // }});
        
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
            let occupiables = []
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
                        if (res instanceof Element) res.setAttribute("name", featureInfo.name + "." + key);
                        if (layer.index) {
                            res.styles = {"z-index": layer.index}
                        }
                        if (SvgPlus.is(element, OccupiableWindow)) {
                            occupiables.push([element, key])
                        }
                    }
                }
            }

            let {name} = featureInfo;
            if (occupiables.length == 1) {
                this.occupiables[name] = occupiables[0][0];
            } else {
                for (let [element, key] of occupiables) {
                    this.occupiables[name+"/"+key] = element
                }
            }

            this[name + "Public"] = createFeatureProxy(feature, featureInfo);
            this[name] = feature;

            return [feature, featureInfo];
        }

        // Instantiate all features.
        let features = Features.FEATURES.map(makeFeature);

        // Initialise all features.
        await Promise.all(features.map(async ([feature, info]) => {
            await feature.initialise() 
            setLoadState(info.name, 2);
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
                    await this.initialiseSessionConnection();
                    break;
                case ERROR_CODES.WAITING_APPROVAL: 
                    this.loaderText = `The host has not yet granted you approval to join. </br> Please wait for the host to approve your request.`
                    await sessionConnection.waitForApproval();
                    await this.initialiseSessionConnection();
                    break;
                case ERROR_CODES.IN_SESSION:
                    this.loaderText = `You are currently in another session please end this session before joining a new session.`
                    break;
                default:
                    this.loaderText = `An unexpected error occured please refresh and try again. </br> ${error}`
            }
        } else {
            setLoadState("connection", 2);
        }

        this.endlinkHost = this.endlinkHost;
        this.endlinkParticipant = this.endlinkParticipant;
    }

    async initialiseFixedAspect(){
        const {me, them} = this.sdata;

        // Create a blank element to get the aspect ratio of the screen
        let blank = new ShadowElement("dummy-element");
        let area = this.sessionView.addScreenArea("fullAspectArea", blank);
        area.styles = {"z-index": -1};

        // Store the aspect ratios of the both users screen
        let aspects = {
            [me]: null,
            [them]: null
        };

        // Picks the aspect ratio of the participant if possible
        // otherwise picks the aspect ratio of this user
        let chooseAspect = () => {
            let size = null;
            if (this.sdata.isUserActive("participant") && aspects.participant !== null) {
                size = aspects.participant;
            } else {
                size = aspects[me];
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
        };

        // Watch for resize changes in the full aspect area
        let observer = new ResizeObserver(() => {
            let size = blank.bbox[1];
            aspects[me] = size;
            this.sdata.set(`aspect/${me}`, {x: size.x, y: size.y});
            chooseAspect();
        });
        observer.observe(blank);

        // Watch for changes in the aspect ratio from the database
        this.sdata.onValue("aspect", (val) => {
            if (val !== null) {
                if ("participant" in val) {
                    aspects.participant = new Vector(val.participant);
                } else if ("host" in val) {
                    aspects.host = new Vector(val.host);
                }
                chooseAspect();
            }
        });

        this.sdata.onUser("joined", chooseAspect);
        this.sdata.onUser("left", chooseAspect);
    }

    async initialiseWindowManager(){
        let updateSidePanel = (value) => {
            value = value == "v-side" ? "sidePanel" : "topPanel";
            this.panelMode = value;
            
            if (this.currentOccupier) {
                this.togglePanel("sidePanel", value == "sidePanel");
                this.togglePanel("topPanel", value == "topPanel");
            }
        }
        this.settings.addEventListener("change", (e) => {
            let {user, group, setting, value} = e;
            if (user == this.sdata.me && group == "display" && setting == "layout") {
                updateSidePanel(value);
            }

            if (user == this.sdata.me && group == "display" && setting == "font") {
                this.sessionView.root.setAttribute("font", value);
            }
            if (user == this.sdata.me && group == "display" && setting == "effect") {
                if (value == "none") {
                    this.sessionView.root.removeAttribute("effect");
                } else {
                    this.sessionView.root.setAttribute("effect", value);
                }
            }
        })
        this.sessionView.root.setAttribute("font", this.settings.get(`${this.sdata.me}/display/font`));
        this.sessionView.root.setAttribute("effect", this.settings.get(`${this.sdata.me}/display/effect`));
        updateSidePanel(this.settings.get(`${this.sdata.me}/display/layout`));


        return new Promise((r) => {
            this.sdata.onValue("occupier", async (name) => {
                await this.openWindow(name);
                r();
            })
        })
    }   

    async toggleOpenByKey(window) {
      let wasSwitching = this.accessControl.isSwitching;
        if (wasSwitching) {
            await this.accessControl.endSwitching();
        }
        await this.openWindow(this.occupier === window ? "default" : window);
        if (wasSwitching) this.accessControl.startSwitching();
    }

    keyboardShortcuts = {
        "v": () => this.videoCall.toggleMuted("video", this.sdata.me),
        "a": () => this.videoCall.toggleMuted("audio", this.sdata.me),
        "e": () => this.eyeGaze.eyeGazeOn = !this.eyeGaze.eyeGazeOn,
        "g": () => this.toggleOpenByKey("aacGrid"),
        "q": () => this.toggleOpenByKey("quiz"),
        "s": () => this.toggleOpenByKey("settings"),
        "c": () => this.toggleOpenByKey("eyeGaze"),
        "f": () => this.toggleOpenByKey("shareContent"),
        "x": () => {
            if (this.accessControl.isSwitching) {
                this.accessControl.endSwitching();
            } else {
                this.accessControl.startSwitching(!this.occupier);
            }
        }
    }
    async initialiseKeyboardShortcuts() {
        window.addEventListener("keydown", (e) => {
            let notInInput = document.activeElement === document.body;
            let validKey = e.key in this.keyboardShortcuts;
            let enabled = this.settings.get(`${this.sdata.me}/keyboardShortcuts/${e.key}`);
            
            if(notInInput && validKey && enabled) {
                e.preventDefault();
                e.stopPropagation();
                this.keyboardShortcuts[e.key]();
            }
        });
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

    set endlinkHost(link) {
        this["endlink-host"] = link;
    }
    set ["endlink-host"](link) {
        this._endLinkHost = link;
        console.log("host link - ", link);
        
        if (sessionConnection !== null && sessionConnection.isHost) {
            sessionConnection.onleave = async () => {
                let hostUID = sessionConnection.hostUID;
                let params = new URLSearchParams({
                    sid: sessionConnection.sid,
                    host: hostUID,
                    hostName: (await get(ref(`users/${hostUID}/info/displayName`))).val()
                });
                window.location.href = link +"?"+ params.toString();
            }
        }
    }
    get endlinkHost() {
        return this._endLinkHost;
    }

    set endlinkParticipant(link) {
        this["endlink-participant"] = link;
    }
    set ["endlink-participant"](link) {
        this._endLinkParticipant = link;
        console.log("participant link - ", link);
        
        if (sessionConnection !== null && !sessionConnection.isHost) {
            sessionConnection.onleave = async () => {
                let hostUID = sessionConnection.hostUID;
                let params = new URLSearchParams({
                    sid: sessionConnection.sid,
                    host: hostUID,
                    hostName: (await get(ref(`users/${hostUID}/info/displayName`))).val()
                });
                window.location.href = link +"?"+ params.toString();
            }
        }
    }
    get endlinkParticipant() {
        return this._endLinkParticipant;
    }

    get squidlyLoader(){
        return document.querySelector("squidly-loader")
    }

    set loaderVideo(video) {
        if (this.squidlyLoader) {
            if (!this._loaderVideoEl) {
                let videoEl = new SvgPlus("video");
                videoEl.styles = {
                    "border-radius": "0.5em",
                    width: "50%",
                    height: "50%",
                    position: "absolute",
                    transform: "translate(-50%, -50%)",
                    top: "40%",
                    "border": "2px solid #8F53C9",
                    left: "50%",
                    "object-fit": "cover",
                    "z-index": 3
                }
                videoEl.setAttribute("autoplay", "");
                videoEl.setAttribute("muted", "");
                videoEl.setAttribute("playsinline", "");
                videoEl.setAttribute("loop", "");
                this.squidlyLoader.appendChild(videoEl);
                this._loaderVideoEl = videoEl;
                videoEl.play();
            }
            if (video == null || video == "") {
                this._loaderVideoEl.remove();
                this._loaderVideoEl = null;
            } else {
                this._loaderVideoEl.setAttribute("src", video);
            }

        }
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

    static get observedAttributes() {
        return ["endlink-host", "endlink-participant"];
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

     /** @return {?VideoCall} */
    get videoCall(){
        return $$.get(this).videoCallPublic;
    }

    /** @return {?SettingsFeature} */
    get settings(){
        return $$.get(this).settingsPublic;
    }

    /** @return {?Text2Speech} */
    get text2speech(){
        return $$.get(this).text2speechPublic;
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

    get isOccupied() {
        return $$.get(this).occupier !== null;
    }

    get currentOpenFeature(){
        return $$.get(this).occupier;
    }

    async openWindow(name) {
        await $$.get(this).openWindow(name)
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

    async toggleRestBar(isShown) {
        await $$.get(this).togglePanel("bottomPanel", isShown);
    }
}

SvgPlus.defineHTMLElement(SquidlySessionElement)
