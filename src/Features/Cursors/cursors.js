import { SvgPlus } from "../../SvgPlus/4.js";
import { Vector } from "../../SvgPlus/vector.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { POINTERS, SvgResize } from "../../Utilities/svg-resize.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";

const MAXTIME = 5000;

const size2num = {
    "small": 1,
    "medium": 2,
    "large": 3,
}
const col2num = {
    "colour-1":0,
    "colour-2":1,
    "colour-3":2,
    "colour-4":3,
    "colour-5": 4,
}

const style2Key = {
    "arrow": "a",
    "guide": "r",
    "circle": "c",
}

/**
 * @typedef {Object} CursorProperties
 * @property {string} class - the class of the cursor (i.e. simple, cursor)
 * @property {number} size - the size of the cursor
 * @property {string} text - the fill colour of the cursor
 * @property {string} type - the type of the cursor (i.e. [size = 0-3][color = 0-4])
 * @property {string} guide - the svg path data for the guide
 */

class Cursor extends HideShowTransition {
    cursorIcon = null;
    constructor(){
        super("g")
    }

    /**
     * @param {CursorProperties} properties
     */
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

export default class Cursors extends Features {
    cursorLibrary = {};
    referenceArea = "entireScreen";
    cursorTimeouts = {};

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
        if (position !== null) {
            position = this.rel_bbox2rel_ref(position, bbox);
        }
       if (position == null) {
           this.sdata.set(`positions/${name}`, null);
           this._updatePosition(null, name)
        } else {
            position.timeStamp = new Date().getTime()
            this.sdata.set(`positions/${name}`, {x: position.x, y: position.y, timeStamp: position.timeStamp});
            this._updatePosition(position, name)
        }
    }
    
    updateReferenceArea(name){
        this._referenceArea = name;
        this.sdata.set("reference", name);
    }
    
    rel_bbox2rel_ref(point, bbox){
        let newPos = null;
        try {
            point = point.mul(bbox[1]).add(bbox[0]);
            let [pos, size] = this.referenceBBox;
            newPos =  point.sub(pos).div(size);
        } catch (e) {
            newPos = null;
        }
        return newPos;
    }

    rel_ref2rel_entire(relPoint) {
        let newPos = null;
        try {
            let [pos, size] = this.referenceBBox;
            let screen = relPoint.mul(size).add(pos);
            let [pose, sizee] = this.cursorsPanel.bbox;
            newPos = screen.sub(pose).div(sizee);
        } catch (e) {
            newPos = null;
        }
        return newPos;
    }

    get me() {return this.sdata.isHost ? "host" : "participant"}

    get referenceBBox() {
        if (this._referenceArea in this) {
            return this[this._referenceArea].bbox;
        } else {
            return [new Vector, new Vector]
        }
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVAE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    _getMouseCursorProperties(user) {
        let size = this.session.settings.get(`${user}/cursors/cursorSize`);
        let colour = this.session.settings.get(`${user}/cursors/cursorColour`);
        let style = this.session.settings.get(`${user}/cursors/cursorStyle`);
        let type = null;
        if (size != "none" && size != null) {
            size = size2num[size];
            colour = col2num[colour];
            style = style2Key[style] || "a";
            type = `${size}${colour}${style}`;
        } else {
            type = "-";
        }
        return {type, class: "cursor"}
    }

    _watchMouseCursorPosition() {
        let update = false;

        let updatef = () => {
            let props = this._getMouseCursorProperties(this.me);
            update = props.type !== null;
            if (props.type !== null) {
                this.updateCursorProperties(this.me + "-mouse", props);
            } else {
                this.updateCursorPosition(this.me + "-mouse", null, null);
            }
        }
        updatef();
        this.session.settings.addEventListener("change", (e) => {
            let {user, group} = e;
            if (user == this.me && group == "cursors") {
                updatef();
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (update) {
                let pos = null;
                let size = null;
                try {
                    pos = new Vector(e.clientX, e.clientY);
                    size = new Vector(window.innerWidth, window.innerHeight);
                    pos = pos.div(size);
                } catch (e) {
                    pos = null;
                }
                this.updateCursorPosition(this.me + "-mouse", pos, [new Vector(0, 0), size]);
            } 
        });
    }

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
        if (pos !== null && new Date().getTime() - pos.timeStamp > MAXTIME) {
            pos = null;
        }

        if (pos !== null) {
            clearTimeout(this.cursorTimeouts[name]);
            pos = new Vector(pos);
            pos = this.rel_ref2rel_entire(pos);
            if (!(name in this.cursorLibrary) || !this.cursorLibrary[name].icon) {
                this._createNewCursor(name);
            }
            this.cursorLibrary[name].icon.position = new Vector(pos);
            this.cursorLibrary[name].icon.show();
            this.cursorTimeouts[name] = setTimeout(() => {
                this._updatePosition(null,name);
            }, MAXTIME)

            const event = new Event(name);
            event.screenPos = pos;
            this.dispatchEvent(event)
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
        this._watchMouseCursorPosition();
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get privatePropertyNames(){return ["svg", "cursorLibrary", "entireScreen"]}

    static get layers() {
        return {
            cursorsPanel: {
                type: "area",
                area: "entireScreen",
                index: 320,
                mode: "overlay"
            },
            fullAspectArea: {
                type: "area",
                area: "fullAspectArea",
                mode: "overlay",
                index: -1,
            },
            fixedAspectArea: {
                type: "area",
                area: "fixedAspectArea",
                mode: "overlay",
                index: -1,
            }
        }
    }

    static get name(){
        return "cursors";
    }

    static get firebaseName(){
        return "cursors";
    }
}
