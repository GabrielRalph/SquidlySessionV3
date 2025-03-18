import { FirebaseFrame } from "../Firebase/firebase-frame.js";
import { SessionDataFrame } from "../squidly-session.js";
import { ShadowElement } from "../Utilities/shadow-element.js";

/**
 * @typedef {import("../squidly-session.js").SquidlySession} SquidlySession
 * @typedef {import("../squidly-session.js").SessionDataFrame} SessionDataFrame
 *  
 * 
 * @callback EventCallback
 * @param {Event} event - ...
*/

export class Features {
    /** @type {Object.<string, [EventCallback]>} */
    eventListeners = {}

    /** @type {SquidlySession} */
    session = null;

    /** @type {SessionDataFrame} */
    sdata = null;

    /** 
     * @param {SquidlySession} session 
     * @param {SessionDataFrame} sDataFrame
     * */
    constructor(session, sDataFrame) {
        this.session = session;
        this.sdata = sDataFrame;
    }

    /**
     * @override
     * @return {Promise}
     */
    async initialise() {}

    /**
     * @override
     * @return {[ShadowElement]}
     */
    getElements(){
    }


    /**
     * @override
     * @param {Event} event
     */
    dispatchEvent(event) {
        if (event instanceof Event) {
            if (event.type in this.eventListeners) {
                for (let callback of this.eventListeners[event.type]) {
                    callback(event);
                    if (event.defaultPrevented) {
                        break;
                    }
                }
            }
        } else {
            throw "Dispatch event called with non event object."
        }
    }

    
    /**
     * @override
     * @param {string} type
     * @param {EventCallback} callback
     */
    addEventListener(type, callback) {
        if ((typeof type === "string" && type.length > 0) && callback instanceof Function) {
            if (!(type in this.eventListeners)) this.eventListeners[type] = []
            this.eventListeners[type].unshift(callback);
        } else {
            if (typeof type !== "string" || type.length == 0) {
                throw "Event listener type must be a non empty string."
            } else {
                throw "Event listener callback must be a function."
            }
        }
    }


    /**
     * @override
     * @param {string} type
     * @param {EventCallback} callback
     */
    removeEventListener(type, callback) {
        if (type in this.eventListeners) {
            this.eventListeners[type] = this.eventListeners[type].filter(cb => cb !== callback)
        } 
    }


    static get firebaseName(){
        return "feature"
    }


    /**
     * @override
     */
    static async loadResources(){
    }
}