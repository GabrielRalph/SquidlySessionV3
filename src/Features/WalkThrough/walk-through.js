import { Vector } from "../../SvgPlus/vector.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";
import { MaskOverlay } from "./mask-overlay.js";

/**
 * This is a starting point for creating a hints box for the walk-through.
 * @extends {HideShowTransition}
 */
class HintsBox extends HideShowTransition {
    constructor() {
        super("hints-box");

        this.createChild("h3", { content: "Walk-Through Hints" }, "title");
        this.createChild("div", { content: "This is where hints will go." }, "hints");

        /** @type {GridLayout} */
        let buttons = this.createChild(GridLayout, {}, 1, 2);
        
        this.closeButton = buttons.add(new GridIcon({
            type: "action",
            symbol: "close",
            displayValue: "Close Hints",
            events: {
                "access-click": (e) => {
                    /* do something to
                      note: if you need to execute a transition, use e.waitFor(promise)
                      if you want to send the event upstream create a new AccessEvent and dispatch that
                      like: this.dispatchEvent(new AccessEvent("access-click", e, {bubbles: true}));
                    */
                }
            }
        }), 0, 1);

        this.openButton = buttons.add(new GridIcon({
            type: "emphasis",
            symbol: "refresh",
            displayValue: "Open Hints",
            events: {
                "access-click": (e) => {
                    /* do something to
                      note: if you need to execute a transition, use e.waitFor(promise)
                      if you want to send the event upstream create a new AccessEvent and dispatch that
                      like: this.dispatchEvent(new AccessEvent("access-click", e, {bubbles: true}));
                    */
                }
            }
        }), 0, 0);
    }
}


/**
 * This is the main overlay element for the walk-through feature.
 * It contains the mask overlay and the hints box. You can add 
 * more elements as needed.
 * @extends {ShadowElement}
 */
class WalkThroughOverlayElement extends ShadowElement {
    constructor() {
        super("walk-through-overlay");

        // Create the mask overlay
        this.mask = this.createChild(MaskOverlay, {
            class: "mask-overlay",
        }, "maskOverlay");

        this.hints = this.createChild(HintsBox);
        this.hints.shown = false;
        // Show the mask
        this.mask.shown = false;
    }

    static get usedStyleSheets() {
        return [
            relURL("./styles.css", import.meta),
            GridIcon.styleSheet
        ]
    }
}

/**
 * The WalkThrough feature is the main class for the walk-through functionality.
 * It manages the overlay, mask, and hints as well as gaining access to other features
 * and firebase if needed. 
 * 
 * @extends {Features}
 */
export default class WalkThroughFeature extends Features {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     * @param {import("../features-interface.js").SessionDataFrame} sdata
     */
    constructor(session, sdata){
        super(session, sdata)
        this.walkThroughOverlay = new WalkThroughOverlayElement();
    }

    /**
     * Gets a function that defines a mask area based on a grid layout.
     * @param {number} rows - Number of rows in the grid.
     * @param {number} cols - Number of columns in the grid.
     * @param {number} rowStart - Starting row index (inclusive).
     * @param {number} colStart - Starting column index (inclusive).
     * @param {number} rowEnd - Ending row index (exclusive).
     * @param {number} colEnd - Ending column index (exclusive).
     * @returns {function(number, number): {pos: Vector, size: Vector, border: number}} A function that takes width and height and returns a mask area. 
     * 
     * Some constants for layout:
     * @see GridIcon Utilities/grid-icon.js
     * @see /Utilities/grid-icon.css
     */
    getArea(rows=3, cols=4, rowStart=0, colStart=0, rowEnd = rowStart+1, colEnd = colStart+1) {
        return (W, H) => {
            // Get the height of the settins path header
            const h1 = this.session.settings.settingsPathClientHeight;

            // Some constants for layout
            const border = 4;
            const gap = 1.25 * border;

            let iw = (W - (cols+1) * gap)/cols;
            let ih = (H - h1 - (rows+1) * gap)/rows;

            let y = h1 + rowStart * (ih + gap) + gap/2;
            let x = colStart * (iw + gap) + gap/2;

            let wr = (colEnd - colStart) * (iw + gap);
            let hr = (rowEnd - rowStart) * (ih + gap);

            let br = 0.015 * Math.min(window.innerWidth, window.innerHeight) + gap/2;

            return {
                pos: new Vector(x, y),
                size: new Vector(wr, hr),
                border: br
            }
        }
    }

    async dummyWalkThrough() {
         const {mask, hints} = this.walkThroughOverlay;
        // start the mask rendering
        mask.start();
        
        // Step 1: Navigate to the access settings
        await Promise.all([
            this.session.settings.gotoPath("home/participant/access"),
            this.session.openWindow("settings"),
        ])

        // Step 2: Highlight the switch time access control
        mask.addArea(this.getArea(3, 4, 0, 1, 3, 2));
        await mask.show()
        await hints.show();

        // Wait for 3 seconds
        await delay(3000);

        // Step 3: Highlight the eye gaze calibration button
        mask.clearAreas();
        mask.addArea(this.getArea(3, 4, 1, 2, 3, 3));
        await delay(3000);

        await mask.hide();
    }

    async initialise() {
        this.session.toolBar.addMenuItem("access", {
            name: "walk-through",
            symbol: "user",
            onSelect: e => this.dummyWalkThrough()
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static async loadResources() {
        //load any resources required for this feature
        WalkThroughOverlayElement.loadStyleSheets();
    }


    // // Uncomment this and rebuild as per the README.
    // static get name() {
    //     return "walkThrough"
    // }

    static get layers() {
        return {
            walkThroughOverlay: {
                type: "area",
                area: "fullAspectArea",
                index: 230,
            }
        }
    }

    static get firebaseName(){
        return "walk-through";
    }
}