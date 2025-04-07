import { SvgPlus } from "../../SvgPlus/4.js";
import { Vector } from "../../SvgPlus/vector.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { POINTERS, SvgResize } from "../../Utilities/svg-resize.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";



class Cursor extends HideShow {
    cursorIcon = null;
    constructor(){
        super("g")
    }

    set properties(properties) {
        let position = this.position;
        this.innerHTML = "";
        let icon = this.createChild(POINTERS[properties.class], {}, 0);
        for (let key in properties) {
            if (key !== "class")
                icon[key] = properties[key];
        }
        icon.shown = true;
        icon.position = position;
        this.cursorIcon = icon;
    }


    /**
     * @param {Vector} vector
     */
    set position(vector) {
        if (this.cursorIcon) {
            this.cursorIcon.position = vector;
        }
        this._position = vector;
    }

    get position(){
        return this._position;
    }
}


function getDefaultCursorProperties() {
    return {
        class: "simple",
        size: 20,
    }
}
export class Cursors extends Features {
    cursorLibrary = {};
    referenceArea = "entireScreen";
    constructor(session, sDataFrame){
        super(session, sDataFrame);
        this.cursorsPanel = new ShadowElement("cursors-panel");
        this.svg = this.cursorsPanel.createChild(SvgResize);
        this.svg.shown = true;
        this.svg.start();
        this.fixedAspectArea = new ShadowElement("fixed-aspect-reference");
        this.fullAspectArea = new ShadowElement("full-aspect-reference");
        this.entireScreen = this.cursorsPanel;
    }   

    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    /**
     * @param {string} name the name of the cursor who's properties are to be updated
     * @param {Object} properties the properties of the cursor
    */
   updateCursorProperties(name, properties) {
       if (typeof properties !== "object") properties = null;
       this.sdata.set(`properties/${name}`, properties);
       this._updateProperties(properties, name)
    }
    
    /**
     * @param {string} name the name of the cursor who's position is to be updated
     * @param {Vector} position of the cursor in units (i.e. [0, 1]) relative to the 
     *                          the given bounding box
     * @param {[Vector, Vector]} bbox the position and size of the bounding box to which
     *                                the position vector is relative too.
    */
   updateCursorPosition(name, position, bbox) {
       if (position == null) {
           this.sdata.set(`positions/${name}`, null);
           this._updatePosition(null, name)
        } else {
            let relFixed = this.rel_bbox2rel_ref(position, bbox);
            this.sdata.set(`positions/${name}`, {x: relFixed.x, y: relFixed.y});
            this._updatePosition(relFixed, name)
        }
    }
    
    updateReferenceArea(name){
        this._referenceArea = name;
        this.sdata.set("reference", name);
    }
    
    

    rel_bbox2rel_ref(point, bbox){
        point = point.mul(bbox[1]).add(bbox[0]);
        let [pos, size] = this.referenceBBox;
        let relPoint = point.sub(pos).div(size);
        return relPoint;
    }

    rel_ref2rel_entire(relPoint) {
        let [pos, size] = this.referenceBBox;
        let screen = relPoint.mul(size).add(pos);
        let [pose, sizee] = this.cursorsPanel.bbox;
        return screen.sub(pose).div(sizee);
    }

    get me() {return this.sdata.isHost ? "host" : "participant"}

    get referenceBBox() {
        return this[this._referenceArea].bbox;
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVAE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    _createNewCursor(name) {
        if (!(name in this.cursorLibrary)) {
            this.cursorLibrary[name] = {};
        }
        if (!this.cursorLibrary[name].properties) {
            this.cursorLibrary[name].properties = getDefaultCursorProperties();
        }

        let icon = new Cursor();
        icon.properties = this.cursorLibrary[name].properties;
        this.svg.appendChild(icon);
        this.cursorLibrary[name].icon = icon;
    }

    _removeCursor(name) {
        if (name in this.cursorLibrary) {
            let cursor = this.cursorLibrary[name];
            if (cursor.icon) {
                cursor.icon.remove();
            }
            delete this.cursorLibrary[name];
        }
    }

    _updateProperties(props, name) {
        if (!(name in this.cursorLibrary)) {
            this.cursorLibrary[name] = {}
        }
        this.cursorLibrary[name].properties = props
        if (this.cursorLibrary[name].icon) {
            this.cursorLibrary[name].icon.properties = props;
        }
    }

    _updatePosition(pos, name) {
        if (pos !== null) {
            pos = new Vector(pos);
            pos = this.rel_ref2rel_entire(pos);
            if (!(name in this.cursorLibrary) || !this.cursorLibrary[name].icon) {
                this._createNewCursor(name);
            }
            this.cursorLibrary[name].icon.position = new Vector(pos);
            this.cursorLibrary[name].icon.show();
        } else if (name in this.cursorLibrary && this.cursorLibrary[name].icon) {
            this.cursorLibrary[name].icon.hide();
        }
    }

    async initialise(){
        this.sdata.onValue("reference", (val) => {
            this.referenceArea = val;
        })
        this.sdata.onChildAdded("properties", this._updateProperties.bind(this))
        this.sdata.onChildChanged("properties", this._updateProperties.bind(this))
        this.sdata.onChildRemoved("properties", (_, name) => {
            this._removeCursor(name)
        })

       
        this.sdata.onChildAdded("positions", this._updatePosition.bind(this))
        this.sdata.onChildChanged("positions", this._updatePosition.bind(this))
        this.sdata.onChildRemoved("positions", (_, name) => {
            this._updatePosition(null, name)
        })
    }

    static get privatePropertyNames(){return ["svg", "cursorLibrary", "entireScreen"]}

    static get name(){
        return "cursors";
    }

    static get firebaseName(){
        return "cursors";
    }
}
