import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";

class NotificationPanel extends ShadowElement {
    
    constructor(){
        super("notification-panel");
        this.yOffset = 0;
    }

    set yOffset(v){
        this.root.style.setProperty("--y-offset", v);
        this._yOffset = v;
    }
    get yOffset(){
        return this._yOffset;
    }

    async queue(){
        let lastT = 0;
        await this.waveTransition((t) => {
            this.yOffset += t - lastT;
            lastT = t;
        }, 500, true);
    }

    async dequeue(node){
        let root = this.root;
        await this.waveTransition((t) => {
            node.style.setProperty("opacity", t);
        }, 500, false);
        node.remove();
        [...root.children].forEach((c, i) => c.style.setProperty("--y-position", i+1));
        this.yOffset -= 1;
    }

    async notify(text, type = "info") {
        let {root} = this;
        let notification = root.createChild("div", {class: "notification", type, content: text});
        notification.style.setProperty("--y-position", root.children.length);
        await this.queue();
        await delay(3000);
        await this.dequeue(notification);
    }

    static get usedStyleSheets(){
        return [relURL("style.css", import.meta)]
    }

}

export default class Notifications extends Features {
    constructor(session, sDataFrame){
        super(session, sDataFrame);
        this.notificationPanel = new NotificationPanel();
    }   

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    notify(text, type = "info") {
        this.notificationPanel.notify(text, type);
    }

    async initialise(){
        await this.notificationPanel.loadStyles();
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get layers() {
        return {
            notificationPanel: {
                type: "area",
                area: "entireScreen",
                index: 120,
                mode: "overlay"
            }
        }
    }

    static get name(){
        return "notifications";
    }
    static get firebaseName(){
        return "notifications";
    }

}
