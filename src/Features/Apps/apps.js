import { HideShow } from "../../Utilities/hide-show.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { Vector } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/grid-icon.js";

const AppsList = [
    "https://cursor-splash.squidly.com.au",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501"
]


class QuizSearch extends SearchWindow {
    constructor(apps){
        super();
        this.apps = apps;
        this.styles = {
            background: "white",
        }
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
                    
                    symbol: q.icon,
                    type: "image",
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
        }, 4, 5);
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
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        // Add switch app icon
        // let switchAppIcon = new GridIcon({
        //     symbol: "switch",
        //     displayValue: "Switch Mode",
        //     type: "action",
        //     // TODO: add switch app logic
        //     // Send message to iframe to switch app
        //     events: {
        //         "access-click": (e) => {
        //             // this.feature.switchApp();
        //             // only send "switch_app" command
        //             this.sendMessage({
        //                 command: "switch_app",
        //                 // app: this.feature.appDescriptors[0]
        //             });
        //         }
        //     }
        // }, "apps");
        // switchAppIcon.styles = {
        //     "pointer-events": "all",
        // }

        this.grid.add(closeIcon, 0, 0);
        // this.grid.add(switchAppIcon, 1, 0);
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
        this.currentAppIndex = null;
        this._cursorListenersInitialized = false;
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

    _message_firebaseSet(e) {
        let path = "appdata/" + e.data.path;
        this.sdata.set(path, e.data.value);
    }

    _message_firebaseOnValue(e) {
        let path = "appdata/" + e.data.path;
        this.sdata.onValue(path, (value) => {
            this.appFrame.sendMessage({
                mode: "firebaseOnValueCallback",
                path: e.data.path,
                value: value
            });
        });
    }

    _message_setIcon(e) {
        let icon = new GridIcon(e.data.options);
        icon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }
        this.appFrame.grid.add(icon, e.data.x, e.data.y);
        icon.events = {
            "access-click": (event) => {
                this.appFrame.sendMessage({
                    mode: "onIconClickCallback",
                    key: e.data.key,
                    value: {clickMode: event.clickMode}
                });
            }
        }
    }

    _message_addCursorListener(e) {
        // Prevent duplicate listener setup
        if (this._cursorListenersInitialized) return;
        this._cursorListenersInitialized = true;

        // Listen to LOCAL eye gaze data (current user's own eye gaze)
        this.session.eyeGaze.addEyeDataListener((eyeP, bbox, hidden) => {
            if (eyeP instanceof Vector && !hidden && this.appFrame?.iframe) {
                this.appFrame.sendMessage({
                    mode: "cursorUpdate",
                    user: this.sdata.me + "-eyes",
                    x: eyeP.x * bbox[1]._x,
                    y: eyeP.y * bbox[1]._y,
                    source: "local"
                });
            }
        });

        // Listen to all remote cursor events (mouse and eye gaze)
        ["mouse", "eyes"].forEach(cursorType => {
            this.session.cursors.addEventListener(this.sdata.them + "-" + cursorType, (e) => {
                if (this.appFrame?.iframe) {
                    this.appFrame.sendMessage({
                        mode: "cursorUpdate",
                        user: this.sdata.them + "-" + cursorType,
                        x: e.screenPos._x * window.innerWidth,
                        y: e.screenPos._y * window.innerHeight,
                        source: "remote"
                    });
                }
            });
        });
    }
    _message_setSettings(e) {
        this.session.settings.setValue(e.data.path, e.data.value);
    }

    _message_debugLog(e) {
        // Forward debug logs to console
        if (e.data.level === 'error') {
            console.error("[Backend->Iframe]", e.data.message, ...(e.data.args || []));
        } else if (e.data.level === 'warn') {
            console.warn("[Backend->Iframe]", e.data.message, ...(e.data.args || []));
        } else {
            console.log("[Backend->Iframe]", e.data.message, ...(e.data.args || []));
        }
    }


    _message_getSettings(e) {
        console.log("Received getSettings request for path: " + e.data.path + ", key: " + e.data.key);
        const value = this.session.settings.get(e.data.path);
        console.log("Retrieved value: " + JSON.stringify(value) + " for path: " + e.data.path);
        // Send the value back to the iframe
        e.source.postMessage({
            mode: "getSettingsResponse",
            key: e.data.key,
            path: e.data.path,
            value: value
        }, "*");
        console.log("Sent response back to iframe with key: " + e.data.key);
    }

    _message_addSettingsListener(e) {
        const path = e.data.path;
        this.session.settings.addEventListener("change", (event) => {
            if (event.path === path) {
                 e.source.postMessage({
                    mode: "settingsUpdate",
                    path: path,
                    value: event.value
                }, "*");
            }
        });
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
                // TODO: to be implemented
                let session_info = {
                    user: this.sdata.me,
                }
                // Inject API into HTML
                info.html = html.replace(/<head\b[^>]*>/, `<head>\n\t<script src = "${apiURL}"></script>\n\t<base href="${url}/">\n\t<script>const session_info = ${JSON.stringify(session_info)}</script>`);
                
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
                this._setApp(selectedApp.index);
                this.currentAppIndex = selectedApp.index;
                this.appFrame.search.hide();
            } else {
                // App was closed by other party
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
    }

    static get name() {
        return "apps"
    }

    static get layers() {
        return {
            appFrame: {
                type: "area",
                area: "fullAspectArea",
                index: 60,
            }
        }
    }

    static get firebaseName(){
        return "apps"
    }
}