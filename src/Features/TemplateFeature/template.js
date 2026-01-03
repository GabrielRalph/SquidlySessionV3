import { Features, OccupiableWindow } from "../features-interface.js";


class DummyWindow extends OccupiableWindow {
    constructor() {
        super("dummy-window");

    }


    static get usedStyleSheets() {
        return [
        ]
    }
}

export default class Template extends Features {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     * @param {import("../features-interface.js").SessionDataFrame} sdata
     */
    constructor(session, sdata){
        super(session, sdata)
    }


    async initialise() {
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static async loadResources() {
        //load any resources required for this feature
        DummyWindow.loadStyleSheets();
    }

    /* Must have name static getter 
       for feature to be recognised 

    static get name() {
        return "walkThrough"
    }
    */

    static get layers() {
        return {
            someElement: {
                type: "area",
                area: "fullAspectArea",
                index: 230,
            }
        }
    }

    static get firebaseName(){
        return "some-name";
    }
}