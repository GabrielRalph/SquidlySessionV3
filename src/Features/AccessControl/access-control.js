import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton, getButtonAtPoint, getButtonGroups } from "../../Utilities/Buttons/access-buttons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL, WaveStateVariable } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";

let SwitchTime = 1; // ms
let DwellTime = 1; // ms

class CircleLoader extends SvgPlus {
    constructor(button, mode) {
        super("svg")
        this.class = "circle-loader";
        this.createChild("defs", {
            content: `
            <filter id="shadow-filter" width="200" height="200" x = "-50" y = "-50">
                <feGaussianBlur stdDeviation="2" result="5635376e-8084-4593-bf3f-fce6227883f5" in="SourceGraphic"></feGaussianBlur>
                <feOffset dx="1" dy="2" result="aa10f1f4-f1a8-4a56-9a05-ca5c70efff60" in="5635376e-8084-4593-bf3f-fce6227883f5"></feOffset>
                <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"></feGaussianBlur>
                <feSpecularLighting in="blur" surfaceScale="2" specularExponent="15" result="highlight" lighting-color="#bbbbbb">
                    <fePointLight x="47" y="305" z="150" result="c039eab2-5ff7-4352-9be9-27b40d7465e5"></fePointLight>
                </feSpecularLighting>
                <feComposite in="highlight" in2="SourceAlpha" operator="in" result="highlightApplied"></feComposite>
                <feComposite in="SourceGraphic" in2="highlightApplied" operator="arithmetic" k2="1" k3="1" result="highlightText"></feComposite>
                <feMerge result="b1172d29-94c4-4279-bd32-653e97456a2f">
                    <feMergeNode in="aa10f1f4-f1a8-4a56-9a05-ca5c70efff60"></feMergeNode>
                    <feMergeNode in="highlightText"></feMergeNode>
                </feMerge>
            </filter>`
        })
        let position = button.getCenter();
        this.props = {
            viewBox: "-50 -50 100 100",
            styles: {
                top: position.y + "px",
                left: position.x + "px",
            }
        },
        this.pathGroup = this.createChild("g");
        this.wsv = new WaveStateVariable(false, 1.1, (t, goal) => {
            this.progress = t;
            position = button.getCenter();
            this.styles = {
                top: position.y + "px",
                left: position.x + "px",
            }
            if (t == goal) {
                this.dispatchEvent(new Event("state-change"))
            }
        })

        this.dwellRelease = mode == "dwell" ? DwellTime : SwitchTime;
        this.dwellTime = mode == "dwell" ? DwellTime : SwitchTime;
    }

    pause(){
        this.wsv.goalValue = this.wsv.transValue;
    }

    force(){
        this.wsv.hardSet(this.wsv.goalValue);
    }
    
    async setGoal(bool) {
        await this.wsv.set(bool);
    }

    set goal(bool){
       this.setGoal(bool);
    }

    set dwellTime(seconds) {
        this.wsv.duration = seconds;
    }

    set dwellRelease(seconds) {
        this.wsv.reverseDuration = seconds
    }

    set progress(num) {
        let radius = 30;

        if (num > 1) num = 1;
        if (num < 0) num = 0;
        let angle = Math.PI * 2 * (1 - num)
        let p1 = new Vector(0, radius);
        let p2 = p1.rotate(angle);

        let rv = new Vector(radius);
       
        let dpath = ""
        if (num > 0 && num < 1) {
          dpath = `M${p1}A${rv},1,${angle > Math.PI ? 0 : 1},0,${p2}`;
        } else if (num == 1) {
          dpath = `M0,${radius}A${rv},0,0,0,0,-${radius}A${rv},0,0,0,0,${radius}`
        }else {
          dpath = "";
        }
        this.pathGroup.innerHTML = `<path d="${dpath}"></path>`
        this._progress = num;
    }
}

class ControlOverlay extends ShadowElement {
    loaders = new Map();
    switchLoaders = [];
    constructor(){
        super("control-overlay");
        this.props = {
            "access-transparent": true,
        }

        this.createChild(CircleLoader, {}, {getCenter: () => new Vector(200,200)})
    }

    /** 
     * @param {AccessButton} b 
     * @param {AccessControl} accessControl
     * */
    async addDwellLoader(b, accessControl, options = {}) {
        if (typeof options !== "object" || options == null) options = {};
        let mode = options.mode || "dwell";


        b.highlight = true;
        let sl = this.createChild(CircleLoader, {}, b, mode);
        if (options.dwellTime) sl.dwellTime = options.dwellTime;
        if (options.dwellRelease) sl.dwellRelease = options.dwellRelease;
        this.loaders.set(b, sl)
        b.ondisconnect = () => {
            sl.force()
        }
        await sl.setGoal(true);
        sl.remove();
        this.loaders.delete(b);
        if(sl.wsv.transValue == 1) {
            accessControl._dwellClick(b);
        }
        b.highlight = false;
    }

    updateDwellButtons(bList, accessControl) {
        let bSet = new Set(bList);
        for (let button of this.loaders.keys()) {
            if (!bSet.has(button)) {
                let loader = this.loaders.get(button);
                loader.setGoal(false);
            }
        }
        for (let button of bSet) {
            if (!this.loaders.has(button)) {
                this.addDwellLoader(button, accessControl);
            } else {
                this.loaders.get(button).setGoal(true);
            }
        }
    }

    /**
     * @param {AccessButton|[AccessButton]} buttons
     */
    async addSwichLoader(buttons){
        if (this._switching) return;
        this._switching = true;

        let switchLoaders = [];
        let selected = false;
        let args = buttons;

        if (!Array.isArray(buttons)) buttons = [buttons];
        
        let proms = buttons.map(async b => {
            b.highlight = true;
            /** @type {CircleLoader} */
            let sl = this.createChild(CircleLoader, {}, b, "switch");

            b.ondisconnect = () => {
                sl.force()
            }

            switchLoaders.push(sl);
            await sl.setGoal(true);
            sl.remove();
            b.highlight = false;
            return null;
        });

        let endProm = Promise.all(proms);

        this.selectSwitch = async () => {
            selected = args;
            for (let sl of switchLoaders) sl.pause();
            await endProm;
        }

        this.endSwitch = async () => {
            selected = null;
            for (let sl of switchLoaders) sl.pause();
            await endProm;
        }

        this.cancelSwitch = async () => {
            selected = "cancel";
            for (let sl of switchLoaders) sl.force();
            await endProm;
        }

        await endProm;

        this.selectSwitch = ()=>{}
        this.endSwitch = ()=>{}
        this.cancelSwitch = ()=>{};

        this._switching = false;
        return selected;
    }

    
    async selectSwitch(){}
    async endSwitch(){}
    async cancelSwitch(){}

    set hideMouse(bool){
        this.styles = {
            "pointer-events": bool ? "all" : null,
        }
    }

    static get usedStyleSheets() {return [relURL("/access-control.css", import.meta)]}
}

function getSwitchButtonGroups() {
    let groups = getButtonGroups();
    let switchGroups = {};
    for (let key in groups) {
        let group = groups[key].filter(b => !b.disableSwitch);
        if (group.length > 0) {
            switchGroups[key] = group;
        }
    }
    return switchGroups;
}

export default class AccessControl extends Features {
    maxTransitionTimeMS = 500;
    constructor(sesh, sdata) {
        super(sesh, sdata);
        this.overlay = new ControlOverlay();

        this.overlay.addEventListener("sv-mousedown", (e) => {
            if (this.isSwitching) {
                this.endSwitching();
            }
        })

        this.session.toolBar.addMenuItem("access", {
            name: "switch",
            index: 180,
            onSelect: async (e) => {
                await e.waitAll()
                if (this.isSwitching) {
                    this.endSwitching();
                } else {
                    this.startSwitching();
                }
            }
        })
      
        window.addEventListener("keydown", (e) => {
            if (e.key == " ") {
                this.overlay.selectSwitch();
            } else if (e.key == "Backspace") {
                this.overlay.cancelSwitch();
            }
        });
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    get isSwitching(){return this._isSwitching}


    getButtonGroup(key){
        let groups = getButtonGroups();
        return groups[key] || [];
    }

    /**
     * Adds a loader to a button. The loader will fill up and then 
     * initiate a click on the button. If the button is disconnected 
     * before the loader fills up then the loader will be removed and 
     * no click will be initiated.
     * 
     * @param {AccessButton} button the button to add the loader to.
     * @param {"dwell"|"switch"|number} loaderTime the time it takes for the loader to fill up in seconds, 
     *                                             If "dwell" or "switch" is provided then the time will be 
     *                                             taken from the corresponding setting for this user.
     */
    async addLoaderToButton(button, loaderTime) {
        if (typeof button == "object" && button != null && button.getCenter instanceof Function) {
            let options = {mode: "dwell"};
            if (loaderTime == "dwell" || loaderTime == "switch") options.mode = loaderTime;
            else if (typeof loaderTime == "number") {
                options.dwellTime = dwellTime;
                options.dwellRelease = dwellTime;
            }
           
            await this.overlay.addDwellLoader(button, this, options);
        } else {
            throw new Error("Invalid button provided to addLoaderToButton");
        }
    }


    /** @param {boolean} showToolbar whether to show the toolbar when switching restarts */
    async restartSwitching(showToolbar = true) {
        if (this.isSwitching) {
            await this.endSwitching();
            this.startSwitching(showToolbar);
        }
    }

    /** @param {boolean} showToolBar whether to show the toolbar when switching begins */
    async startSwitching() {
        // If switching is already in process return
        if (this._isSwitching) return;

        this.sdata.logChange("access.switch", {value: "start"});

        // Fix the toolbar, hide the mouse cursor 
        // and bring up the toolbar.
        this._isSwitching = true;
        // this.overlay.hideMouse = true;
        this.session.toolBar.fixToolbar(true);
        if (!this.session.isOccupied && !this.session.toolBar.isRingShown) {
            await this.session.togglePanel("toolBarArea", true);
        }

        let quit = false;

        // This function represents the asynchronous part 
        // the switching process.
        let switchingPromiseFunction = async () => {
            /** @type {?(string|AccessButton)} */
            let selectedButton = null;
            do {
                /** @type {AccessButton[]} */
                let selectedGroup = null;
                /** @type {string} */
                let selectedGroupName;

                // Get the clickable access button groups
                let groups = getSwitchButtonGroups();
                let keys = Object.keys(groups);
                
                
                // If there is more than one group of access buttons
                if (keys.length > 1) {

                    // Cycle through the groups until either one is 
                    // selected or switching is ended.
                    while (!selectedGroup && !quit) {
                        
                        for (let key of keys) {
                            
                            let group = groups[key];
                            let areVisible = group.map(e => e.isVisible).reduce((a, b) => a && b);
                            if (!areVisible) break;
                            

                            let res = await this.overlay.addSwichLoader(group);
    
                            // Switch has ended or a group has been selected, 
                            // in both cases we break.
                            if (res !== false) { 
                                if (res == group) {
                                    selectedGroup = group;
                                    selectedGroupName = key
                                } else if (res == null) { 
                                    quit = true;
                                }
                                break;
                            }
                        }

                        // Get the new clickable access button groups
                        groups = getSwitchButtonGroups();
                        keys = Object.keys(groups);
                    }
    
                // Otherwise there is only one group so we will select that
                } else if (keys.length > 0) {
                    selectedGroupName = keys[0];
                    selectedGroup = groups[keys[0]];
                } else {
                    quit = true;
                }
                
                // If the switching has not been ended and there is a selected group.
                if (!quit && selectedGroup != null) {

                    // Cycle through all the buttons of the group until one is
                    // selected or the switching is ended.
                    while (!selectedButton && !quit) {
                        for (let button of selectedGroup) {
                            selectedButton = await this.overlay.addSwichLoader(button)
                            
                            if (selectedButton !== false) {
                                if (selectedButton === null) {
                                    quit = true;
                                } else if (selectedButton === "cancel") {
                                    selectedButton = true;
                                }
                                break;
                            }
                        }
                    }
                    
                    // If a button is selected then click that button. Hide the
                    // toolbar if that button was on the toolbar, otherwise show
                    // the toolbar.
                    if (selectedButton instanceof Element) {
                        await selectedButton.accessClick("switch", 10000);
                        if (!this.session.isOccupied && !this.session.toolBar.isRingShown) {
                            await this.session.togglePanel("toolBarArea", true);
                        }
                    }
                    selectedButton = null;
                }

                
            // If the switching has not ended repeat the entire process.
            } while (!quit);
        }

        // Begin the switching process
        let switchingPromise = switchingPromiseFunction();

        // Create the end switching function
        this.endSwitching = async () => {
            quit = true;
            await this.overlay.endSwitch();
            await switchingPromise;
        }

        // Wait for the switching process to end.
        await switchingPromise;

        // Clear endSwitching function unfix the 
        // tool bar and bring back mouse cursor.
        this.endSwitching = () => {}
        this.session.toolBar.fixToolbar(this.session.isOccupied);
        this.overlay.hideMouse = false;
        this._isSwitching = false;
    }

    async endSwitching(){}

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    async _dwellClick(b) {
        this._clickingButton = true;
        await b.accessClick("dwell", 10000);
        this._clickingButton = false;
    }

    _onEyeData(v) {
        if (v instanceof Vector && !this._clickingButton) {
            let {overlay} = this;

            v.x = v.x < 0 ? 0 : (v.x > 1 ? 1 : v.x);
            v.y = v.y < 0 ? 0 : (v.y > 1 ? 1 : v.y);
            v = v.mul(overlay.clientWidth, overlay.clientHeight);
            
            let selected = getButtonAtPoint(v.x, v.y);
            selected = selected ? [selected] : [];
            overlay.updateDwellButtons(selected, this);
        } else {
            this.overlay.updateDwellButtons([], this);
        }
    }

    initialise(){
        this.session.eyeGaze.addEyeDataListener(this._onEyeData.bind(this));
        this.session.settings.addEventListener("change", (e) => {
            let path = e.path.split("/");
            let [user, type, setting] = path;
            if (user == this.sdata.me && type == "access") {
                if (setting == "switchTime") {
                    SwitchTime = e.value;
                } else if (setting == "dwellTime") {
                    DwellTime = e.value;
                }
            }
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get name() {
        return "accessControl";
    }

    static get layers() {
        return {
            overlay: {
                type: "area",
                area: "entireScreen",
                index: 310,
                mode: "overlay"
            }
        }
    }

    static async loadResources(){
        await ControlOverlay.loadStyleSheets();
    }
}