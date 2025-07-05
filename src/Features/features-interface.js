import { ShadowElement } from "../Utilities/shadow-element.js";
import { PublicProxy } from "../Utilities/usefull-funcs.js";

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


    throwInitialisationError(message) {
        throw new FeatureInitialiserError(this, message);
    }


    static get firebaseName(){
        return "feature"
    }


    /**
     * @override
     */
    static async loadResources(){
    }

    /**
     * @override
     * @return {string[]}
     */
    static get privatePropertyNames() { return []}
}

export class OccupiableWindow extends ShadowElement {
    async open() {
        
    }

    async close() {

    }

    get fixToolBarWhenOpen(){
        return this["__+"].fixToolBarWhenOpen;
    }

    static get fixToolBarWhenOpen() {
        return false;
    }
}

export class FeatureInitialiserError extends Error {
    constructor(feature, message) {
        super(feature.__proto__.constructor.name + '.initialise()\n\t' + message)
        this.feature = feature;
        this.displayMessage = message || "An error occurred while initialising the feature.";
    }
}

const PrivateProperties = {
    dispatchEvent: true,
    sdata: true,
    initialise: true,
    open: true,
    close: true,
}

export function createFeatureProxy(feature, f) {
    let privateProps = {};

    // Global private properties
    for (let key in PrivateProperties) privateProps[key] = true;

    // If the static property "privatePropertyNames" returns 
    // an array of strings make properties with those strings private.
    if (Array.isArray(f.class.privatePropertyNames)) {
        for (let val of f.class.privatePropertyNames) {
            if (typeof val === "string") privateProps[val] = true;
        }
    }
    // Make layer elements private 
    if (typeof f.layers === "object" && f.layers !== null) {
        for (let key in f.layers) privateProps[key] = true;
    }
    
    return new PublicProxy(feature, privateProps);
}

