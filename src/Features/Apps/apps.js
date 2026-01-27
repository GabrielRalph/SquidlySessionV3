import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { Vector } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { AccessButton } from "../../Utilities/Buttons/access-buttons.js";

const AppsList = [
    "https://cursor-splash.squidly.com.au",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501"
]


class QuizSearch extends SearchWindow {
    constructor(apps) {
        super();
        this.apps = apps;
        this.styles = {
            background: "white",
        }
    }

    reset(imm) {
        this.closeIcon = "close";
        this.resetSearchItems(imm)
    }

    async getSearchResults(searchPhrase) {
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
        items = filterAndSort(items, searchPhrase, ({ app: { title, subtitle } }) => [title, subtitle]);
        return items;
    }
}

class AppsFrame extends OccupiableWindow {
    constructor(feature, sdata) {
        super("app-frame");
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
            style: { position: "absolute", top: "var(--gap)", left: "var(--gap)", right: "var(--gap)", bottom: "var(--gap)" }
        }, 4, 5);
        this.search = this.createChild(QuizSearch, {
            style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }
        });

        this.offsetX = 0;
        this.offsetY = 0;
        this.observer = new ResizeObserver(([{ contentRect: { x, y, width, height } }]) => {
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
                this.iframe.props = { src };
        })
    }


    // Send Message to iframe
    sendMessage(data) {
        this.iframe.contentWindow.postMessage(data, "*");
    }

    static get usedStyleSheets() {
        return [
            ...SearchWindow.usedStyleSheets,
            GridIcon.styleSheet,
        ]
    }
    static get fixToolBarWhenOpen() { return true }
}

export default class Apps extends Features {
    constructor(session, sdata) {
        super(session, sdata)
        this.appFrame = new AppsFrame(this, sdata);
        this.appFrame.open = this.open.bind(this);
        this.appFrame.close = this.close.bind(this);
        this.currentAppIndex = null;
        this._cursorListenersInitialized = false;
        
        /** @type {Map<string, {proxy: AccessButton, state: Object}>} */
        this._iframeAccessButtons = new Map();
        /** @type {Map<string, Function>} */
        this._iframeSettingsListeners = new Map();
        /** @type {Set<GridIcon>} */
        this._appIcons = new Set();
    }

    async open() {
        await this.appFrame.setSrc("about:blank");
        // Ensure apps are loaded before showing search
        if (!this.appDescriptors || this.appDescriptors.length === 0) {
            await this.loadAppDescriptors();
        }
        await Promise.all([
            this.appFrame.show(),
            this.appFrame.search.reset(true),
            this.appFrame.search.show()
        ])
    }

    async close() {
        // Clear the selected app from Firebase when closing
        this.sdata.set("selected_app", null);
        this.currentAppIndex = null;
        
        // Clear all app-added icons
        this._clearAppIcons();
        
        // Clear all iframe access buttons
        for (const [id, entry] of this._iframeAccessButtons) {
            entry.proxy.remove();
        }
        this._iframeAccessButtons.clear();

        // Remove settings listeners registered by iframe
        for (const [path, handler] of this._iframeSettingsListeners) {
            this.session.settings.removeEventListener("change", handler);
        }
        this._iframeSettingsListeners.clear();
        
        await Promise.all([
            this.appFrame.setSrc("about:blank"),
            this.appFrame.hide()
        ])
    }


    async _setApp(idx) {
        // Clear all app-added icons before loading new app
        this._clearAppIcons();
        
        await this.appFrame.setSrc("about:blank");
        if (idx >= 0 || idx < this.appDescriptors.length) {
            let app = this.appDescriptors[idx];
            await this.appFrame.setSrc(app.html, true);
        }
    }

    /**
     * Clears all icons that were added by apps (via setIcon).
     * Preserves the permanent Exit icon at (0, 0).
     */
    _clearAppIcons() {
        for (const icon of this._appIcons) {
            icon.remove();
        }
        this._appIcons.clear();
    }


    _message_event(e) {
        const data = e.data;

        if (!data?.type || !data?.emode) return;

        let event = null;
        switch (data.emode) {
            case "mouse":
                const { offsetX, offsetY } = this.appFrame
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
            ...(e.data.options.styles || {})
        }
        this.appFrame.grid.add(icon, e.data.x, e.data.y);
        icon.events = {
            "access-click": (event) => {
                this.appFrame.sendMessage({
                    mode: "onIconClickCallback",
                    key: e.data.key,
                    value: { clickMode: event.clickMode }
                });
            }
        }
        // Track this icon so it can be cleared when switching apps
        this._appIcons.add(icon);
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
        if (this._iframeSettingsListeners.has(path)) return;

        const handler = (event) => {
            if (event.path === path) {
                e.source.postMessage({
                    mode: "settingsUpdate",
                    path: path,
                    value: event.value
                }, "*");
            }
        };

        this._iframeSettingsListeners.set(path, handler);
        this.session.settings.addEventListener("change", handler);
    }

    /**
     * Handles registration of an iframe access button.
     * Creates a proxy AccessButton in the parent DOM that forwards clicks to the iframe.
     */
    _message_registerAccessButton(e) {
        const { id, group, order, isVisible, center, bbox } = e.data;
        console.log("[Debug] Registering access button:", id, group, { isVisible, center, bbox });
        
        // Create proxy AccessButton element
        const proxy = new AccessButton(group);
        proxy.order = order;
        proxy.styles = {
            position: "absolute",
            pointerEvents: "none",
            opacity: "0",
            width: "0",
            height: "0",
        };
        
        // Override getCenter to return iframe element's center (translated to parent coords)
        // Note: Get fresh offset each time since iframe position can change on resize
        proxy.getCenter = () => {
            const entry = this._iframeAccessButtons.get(id);
            if (entry && entry.state && entry.state.center) {
                const { offsetX, offsetY } = this.appFrame;
                return new Vector(
                    entry.state.center.x + offsetX,
                    entry.state.center.y + offsetY
                );
            }
            return new Vector(0, 0);
        };
        
        // Override getIsVisible to return iframe element's visibility
        proxy.getIsVisible = () => {
            const entry = this._iframeAccessButtons.get(id);
            return entry && entry.state && entry.state.isVisible;
        };
        
        // Override setHighlight to forward to iframe
        proxy.setHighlight = (isHighlighted) => {
            proxy.toggleAttribute("hover", isHighlighted);
            this.appFrame.sendMessage({
                mode: "setAccessButtonHighlight",
                id: id,
                highlighted: isHighlighted
            });
        };
        
        // Override isPointInElement to check against iframe element's bbox
        // Note: Get fresh offset each time since iframe position can change on resize
        proxy.isPointInElement = (p) => {
            const entry = this._iframeAccessButtons.get(id);
            if (entry && entry.state && entry.state.bbox) {
                const { bbox } = entry.state;
                const { offsetX, offsetY } = this.appFrame;
                // Translate bbox to parent coordinates
                const x = bbox.x + offsetX;
                const y = bbox.y + offsetY;
                const right = x + bbox.width;
                const bottom = y + bbox.height;
                
                // Check if point is within bbox
                return p.x >= x && p.x <= right && p.y >= y && p.y <= bottom;
            }
            return false;
        };
        
        // Listen for access-click and forward to iframe
        proxy.addEventListener("access-click", (event) => {
            console.log("[Debug] Forwarding access-click to iframe:", id, event.clickMode);
            this.appFrame.sendMessage({
                mode: "accessClick",
                id: id,
                clickMode: event.clickMode || "click"
            });
        });
        
        // Store the proxy and initial state
        this._iframeAccessButtons.set(id, {
            proxy: proxy,
            state: { isVisible, center, bbox }
        });
        
        // Add proxy to DOM (hidden, but registered with access control)
        this.appFrame.appendChild(proxy);
    }

    /**
     * Handles unregistration of an iframe access button.
     * Removes the proxy element from the DOM.
     */
    _message_unregisterAccessButton(e) {
        const { id } = e.data;
        
        const entry = this._iframeAccessButtons.get(id);
        if (entry) {
            entry.proxy.remove();
            this._iframeAccessButtons.delete(id);
        }
    }

    /**
     * Handles state updates for an iframe access button.
     * Updates the stored state for the proxy element.
     */
    _message_accessButtonState(e) {
        const { id, isVisible, center, bbox } = e.data;
        console.log("[Debug] Access button state:", id, { isVisible, center, bbox });
        
        const entry = this._iframeAccessButtons.get(id);
        if (entry) {
            entry.state = { isVisible, center, bbox };
        }
    }

    /**
     * Loads app descriptors from the predefined AppsList.
     * @returns {Promise<boolean>} True if at least one app was loaded successfully, false otherwise.
     */
    async loadAppDescriptors() {
        let result = false;
        let apiURL = relURL("./app-base-api.js", import.meta)
        this.appDescriptors = await Promise.all(AppsList.map(async (url) => {
            try {

                // Load index and info
                const [resInfo, resIndex] = await Promise.all([
                    fetch(url + "/info.json", { cache: "no-store" }),
                    fetch(url + "/index.html", { cache: "no-store" })
                ]);
                if (!resInfo.ok || !resIndex.ok) throw new Error("Failed to fetch app descriptor");
                const [info, html] = await Promise.all([resInfo.json(), resIndex.text()]);

                info.url = url;
                // TODO: to be implemented
                let participantActive = this.sdata.isUserActive("participant");
                let session_info = {
                    user: this.sdata.me,
                    participantActive,
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

        if (this.appDescriptors.length > 0) {
            result = true;
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

        return result;
    }

    async initialise() {
        if (await this.loadAppDescriptors()) {
            // Set up toolbar button
            this.session.toolBar.addMenuItem("share", {
                name: "apps",
                index: 180,
                onSelect: e => e.waitFor(this.session.openWindow("apps")),
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
                    this.appFrame.hide();
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

    static get firebaseName() {
        return "apps"
    }
}