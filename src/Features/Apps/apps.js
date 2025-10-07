import { HideShow } from "../../Utilities/hide-show.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { Vector } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/grid-icon.js";

const AppsList = [
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501"
]


class QuizSearch extends SearchWindow {
    constructor(apps){
        super();
        this.apps = apps;
    }

    reset(imm){
        this.closeIcon = "close";
        this.resetSearchItems(imm)
    }

    async getSearchResults(searchPhrase){
        let apps = this.apps;
        /** @type {Answer[]} */
        let items = apps.map(q => {
            return {
                app: q,
                icon: {
                    displayValue: q.title,
                    subtitle: q.subtitle,
                    symbol: q.icon,
                    type: "topic",
                },
            }
        })
        items = filterAndSort(items, searchPhrase, ({app: {title, subtitle}}) => [title, subtitle]);
        return items;
    }
}

class AppsFrame extends OccupiableWindow {
    constructor(feature, sdata) {
        let root = new HideShow("app-frame");
        root.applyIntermediateState = () => {
            root.styles = {
                "display": null,
            }
        }
        root.applyShownState = () => {
            root.styles = {
                "display": null,
            }
        }
        root.applyHiddenState = () => {
            root.styles = {
                "display": "none",
            }
        }
        root.shown = false
        super("app-frame", root);
        this.feature = feature;
        this.sdata = sdata;
      
    
        this.iframe = this.createChild("iframe", {
            style: {
                border: "none",
                width: "100%",
                height: "100%",
                background: "#e0d7d7bd",
                "pointer-events": "all",
            }
        });

        this.grid = this.createChild(GridLayout, {
            style: {position: "absolute", top: "var(--gap)", left: "var(--gap)", right: "var(--gap)", bottom: "var(--gap)"}
        }, 4, 4);
        this.search = this.createChild(QuizSearch, {
            style: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0}
        });

        this.offsetX = 0;
        this.offsetY = 0;
        this.observer = new ResizeObserver(([{contentRect: {x, y, width, height}}]) => {
            this.offsetX = x;
            this.offsetY = y;
        });
        this.observer.observe(this.iframe);
        let closeIcon = new GridIcon({
            symbol: "close",
            displayValue: "Exit",
            type: "action",
            events: {
                "access-click": async (e) => {
                    await this.feature.close();
                    // Release toolbar after closing
                    this.feature.session.openWindow("default");
                }
            }
        }, "apps");
        closeIcon.styles = {
            "pointer-events": "all",
        }

        this.grid.add(closeIcon, 0, 0);
    }

    // Set iframe src or srcdoc
    async setSrc(src, srcdoc = false) {
        return new Promise((res) => {
            this.iframe.onload = () => {
                res();
            }
            this.iframe.srcdoc = srcdoc ? src : null;
            if (!srcdoc)
                this.iframe.props = {src};
            else 
                console.log(src)
        })
    }


    // Send Message to iframe
    sendMessage(data) {
        this.iframe.contentWindow.postMessage(data, "*");
    }

    static get usedStyleSheets(){
        return [
             ...SearchWindow.usedStyleSheets,
             GridIcon.styleSheet,
            ]
    }
    static get fixToolBarWhenOpen() {return true}
}

export class Apps extends Features {
    constructor(session, sdata){
        super(session, sdata)
        this.appFrame = new AppsFrame(this, sdata);
        this.appFrame.open = this.open.bind(this);
        this.appFrame.close = this.close.bind(this);
        this.sdata.set("app_type", null);
        this.currentAppIndex = null;
    }

    async open() {
        await this.appFrame.setSrc("about:blank");
        // Ensure apps are loaded before showing search
        if (!this.appDescriptors || this.appDescriptors.length === 0) {
            await this.loadAppDescriptors();
        }
        await Promise.all([
            this.appFrame.root.show(),
            this.appFrame.search.reset(true),
            this.appFrame.search.show()
        ])
    }

    async close() {
        // Clear the selected app from Firebase when closing
        this.sdata.set("selected_app", null);
        this.currentAppIndex = null;
        await Promise.all([
            this.appFrame.setSrc("about:blank"),
            this.appFrame.root.hide()
        ])
    }


    async _setApp(idx) {
        await this.appFrame.setSrc("about:blank");
        if (idx >= 0 || idx < this.appDescriptors.length) {
            let app = this.appDescriptors[idx];
            await this.appFrame.setSrc(app.html, true);
        }
    }

    
    _message_event(e) {
        const data = e.data;
        
        if (!data?.type || !data?.emode) return;
        
        let event = null;
        switch (data.emode) {
            case "mouse": 
                const {offsetX, offsetY} = this.appFrame
                event = new MouseEvent(data.type, {
                    clientX: data.x + offsetX,
                    clientY: data.y + offsetY,
                    button: data.button,
                    buttons: data.buttons,
                    bubbles: true
                });
                break;
            case "key":
                event = new KeyboardEvent(data.type, {
                    key: data.key,
                    code: data.code,
                    bubbles: true,
                    ctrl: data.ctrlKey,
                    shift: data.shiftKey,
                    alt: data.altKey,
                    meta: data.metaKey,
                    repeat: data.repeat
                });
                break;
        }
        window.dispatchEvent(event);
    }

    _message_log(e) {
        console.log(...e.data.params);
    }

    _message_app_type(e) {
        // Store current cursor type
        this.currentAppType = e.data.type;
        this.sdata.set("app_type", e.data.type);
        console.log("App type received:", e.data.type);
    }

    async loadAppDescriptors() {
        let apiURL = relURL("./app-base-api.js", import.meta)
        this.appDescriptors = await Promise.all(AppsList.map(async (url) => {
            try {

                // Load index and info
                const [resInfo, resIndex] = await Promise.all([
                    fetch(url + "/info.json", {cache: "no-store"}),
                    fetch(url + "/index.html", {cache: "no-store"})
                ]);
                if(!resInfo.ok || !resIndex.ok) throw new Error("Failed to fetch app descriptor");
                const [info, html] = await Promise.all([resInfo.json(), resIndex.text()]);

                info.url = url;

                // Inject API into HTML
                info.html = html.replace(/<head\b[^>]*>/, `<head>\n\t<script src = "${apiURL}"></script>\n\t<base href="${url}/">`);
                
                return info;
            } catch (e) {
                console.warn("Failed to load app from " + url, e);
                return null;
            }
        }))
        
        this.appDescriptors = this.appDescriptors.filter(d => d !== null);

        if (this.appDescriptors.length == 0) {
            this.session.toolBar.setIcon("share/apps/hidden", true);
        } else {
            this.session.toolBar.setIcon("share/apps/hidden", false);
            this.appDescriptors = this.appDescriptors.map((item, idx) => {
                item.index = idx;
                return item;
            })
            this.appFrame.search.addEventListener("value", (e) => {
                if (e.value == null) {
                    e.waitFor(this.session.openWindow("default"));
                } else {
                    // this._setApp(e.value.app.index);
                    // this.appFrame.search.hide();
                    this.sdata.set("selected_app", {
                        index: e.value.app.index,
                        app: e.value.app,
                        timestamp: Date.now()
                    });
                    this._setApp(e.value.app.index);
                    this.appFrame.search.hide();
                }
            })
            this.appFrame.search.apps = this.appDescriptors;
        }
    }

    async initialise(){
        await this.loadAppDescriptors();

        // Set up toolbar button
        this.session.toolBar.addSelectionListener("apps", () => {
            this.session.openWindow("apps");
        })

        this.sdata.onValue("selected_app", (selectedApp) => {
            if (selectedApp) {
                console.log("🔄 Selected app changed in Firebase:", selectedApp);
                this._setApp(selectedApp.index);
                this.currentAppIndex = selectedApp.index;
                this.appFrame.search.hide();
            } else {
                // App was closed by other party
                console.log("🔄 App closed by other party");
                this.currentAppIndex = null;
                this.appFrame.setSrc("about:blank");
                this.appFrame.root.hide();
            }
        });

        // Iframe API Message Listener
        window.addEventListener("message", e => {
           let modeFunc = "_message_" + e.data?.mode;
           if (modeFunc in this && this[modeFunc] instanceof Function) {
                this[modeFunc](e);
           }
        });

        // Listen to app_type changes from Firebase and send to cursor app
        this.sdata.onValue("app_type", (appType) => {
            if (appType !== null) {
                console.log("🔄 App type changed in Firebase:", appType);
                // Send message to cursor app to sync state
                this.appFrame.sendMessage({
                    mode: "sync_app_type",
                    type: appType
                });
            }
        });

        // 1. Listen to LOCAL eye gaze data (current user's own eye gaze)
        this.session.eyeGaze.addEyeDataListener((eyeP, bbox, hidden) => {
            if (eyeP instanceof Vector && !hidden && this.appFrame && this.appFrame.iframe) {
                this.appFrame.sendMessage({
                    user: this.sdata.me + "-eyes",  // "host" or "participant"
                    x: eyeP.x * bbox[1]._x,
                    y: eyeP.y * bbox[1]._y,
                });
            }
        });

        // Listen to all remote cursor events (mouse and eye gaze)
        ["mouse", "eyes"].forEach(cursorType => {
            this.session.cursors.addEventListener(this.sdata.them + "-" + cursorType, (e) => {
                this.appFrame.sendMessage({
                    user: this.sdata.them + "-" + cursorType,
                    x: e.screenPos._x * window.innerWidth,
                    y: e.screenPos._y * window.innerHeight,
                    source: "remote"
                });
            });
        });
    }

    static get firebaseName(){
        return "apps"
    }
}