import { ShadowElement } from "../../Utilities/shadow-element.js";
import { Features } from "../features-interface.js";



class WalkThroughOverlayElement extends ShadowElement {
    constructor() {
        super("walk-through-overlay");
    }
}


export default class WalkThroughFeature extends Features {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     * @param {import("../features-interface.js").SessionDataFrame} sdata
     */
    constructor(session, sdata){
        super(session, sdata)
        this.walkThroughOverlay = new WalkThroughOverlayElement();
    }


    async initialise() {

    }


    static get name() {
        return "walkThrough"
    }

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