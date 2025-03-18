import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton, getButtonGroups } from "../../Utilities/access-buttons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL, WaveStateVariable } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";


class CircleLoader extends SvgPlus {
    constructor(button) {
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
        this.wsv = new WaveStateVariable(false, 1.5, (t, goal) => {
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
    loaders = new WeakMap();
    switchLoaders = [];
    constructor(){
        super("control-overlay");
        this.props = {
            "access-transparent": true,
        }

        this.createChild(CircleLoader, {}, {getCenter: () => new Vector(200,200)})
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
            let sl = this.createChild(CircleLoader, {}, b);

            b.ondisconnect = () => {
                sl.force()
                console.log("force");
                
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
        await endProm;

        this.selectSwitch = ()=>{}
        this.endSwitch = ()=>{}
        this._switching = false;
        return selected;
    }

    
    async selectSwitch(){}
    async endSwitch(){}


    set hideMouse(bool){
        this.styles = {
            "pointer-events": bool ? "all" : null,
        }
    }

    static get usedStyleSheets() {return [relURL("/access-control.css", import.meta)]}
}

export class AccessControl extends Features {
    maxTransitionTimeMS = 500;
    constructor(sesh) {
        super(sesh);
        this.overlay = new ControlOverlay();
        this.session.toolBar.addEventListener("icon-selection", async (e) => {
            if (e.icon.key == "switch") {
                if (this.isSwitching) {
                    this.endSwitching();
                } else {
                    this.startSwitching();
                }
            }
        })

        window.onkeydown =  (e) => {
            if (e.key == " ") {
                this.overlay.selectSwitch();
            }
        }
    }

    get isSwitching(){return this._isSwitching}

    /** @param {boolean} showToolbar whether to show the toolbar when switching restarts */
    async restartSwitching(showToolbar = true) {
        if (this.isSwitching) {
            await this.endSwitching();
            this.startSwitching(showToolbar);
        }
    }
    /** @param {boolean} showToolBar whether to show the toolbar when switching begins */
    async startSwitching(showToolBar = true) {
        // If switching is already in process return
        if (this._isSwitching) return;

        // Fix the toolbar, hide the mouse cursor 
        // and bring up the toolbar.
        this._isSwitching = true;
        this.overlay.hideMouse = true;
        this.session.toolBar.fixToolbar(true);
        if (showToolBar) {
            await this.session.togglePanel("toolBarArea", true);
        }

        let quit = false;

        // This function represents the asynchronous part 
        // the switching process.
        let switchingPromiseFunction = async () => {
            /** @type {?(string|AccessButton)} */
            let selectedButton = "init";
            do {
                /** @type {AccessButton[]} */
                let selectedGroup = null;
                /** @type {string} */
                let selectedGroupName = null;

                // Wait for a set amount of time for UI transition to occur.
                if (selectedButton) {
                    for (let i = 0; i < this.maxTransitionTimeMS / 50; i++) {
                        if (!quit) {
                            await delay(50);
                        } else {
                            break;
                        }
                    }
                } 
                selectedButton = null;
                

                // Get the clickable access button groups
                let groups = getButtonGroups();
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
                                } else { 
                                    quit = true;
                                }
                                break;
                            }
                        }

                        // Get the new clickable access button groups
                        groups = getButtonGroups();
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
                                if (selectedButton == null) {
                                    quit = true;
                                }
                                break;
                            }
                        }
                    }
                    
                    // If a button is selected then click that button. Hide the
                    // toolbar if that button was on the toolbar, otherwise show
                    // the toolbar.
                    if (selectedButton instanceof Element) {
                        selectedButton.accessClick("switch");
                    }
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
        this.session.toolBar.fixToolbar(false);
        this.overlay.hideMouse = false;
        this._isSwitching = false;
    }
    async endSwitching(){}

    getElements(){
        return [this.overlay];
    }

    static async loadResources(){
        await ControlOverlay.loadStyleSheets();
    }
}