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
        /** @type {Map<string, GridIcon>} */
        this._appIcons = new Map();
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

        // Remove firebase value listeners
        if (this._onValueUnsubscribes) {
            for (const unsub of this._onValueUnsubscribes.values()) {
                unsub();
            }
            this._onValueUnsubscribes.clear();
        }

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
            this._sendSessionInfoUpdate();
        }
    }

    /**
     * Clears all icons that were added by apps (via setIcon).
     * Preserves the permanent Exit icon at (0, 0).
     */
    _clearAppIcons() {
        for (const icon of this._appIcons.values()) {
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

        // Cleanup existing listener for this path if it exists
        // (This prevents "zombie" listeners on reload)
        if (this._onValueUnsubscribes && this._onValueUnsubscribes.has(path)) {
            let unsub = this._onValueUnsubscribes.get(path);
            if (unsub) unsub();
        }

        let unsub = this.sdata.onValue(path, (value) => {
            if (!this.appFrame?.iframe) return;
            this.appFrame.sendMessage({
                mode: "firebaseOnValueCallback",
                path: e.data.path,
                value: value
            });
        });

        // Store unsubscribe function
        if (!this._onValueUnsubscribes) this._onValueUnsubscribes = new Map();
        this._onValueUnsubscribes.set(path, unsub);
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
        // Track this icon so it can be cleared when switching apps or removed specifically
        this._appIcons.set(e.data.key, icon);
    }

    _message_removeIcon(e) {
        let key = e.data.key;
        if (this._appIcons.has(key)) {
            let icon = this._appIcons.get(key);
            icon.remove();
            this._appIcons.delete(key);
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
        
        // Remove existing listener if found (cleanup for reloads)
        if (this._iframeSettingsListeners.has(path)) {
            const oldHandler = this._iframeSettingsListeners.get(path);
            this.session.settings.removeEventListener("change", oldHandler);
        }

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

    _sendSessionInfoUpdate() {
        if (!this.appFrame?.iframe) return;
        let participantActive = this.sdata.isUserActive("participant");
        this.appFrame.sendMessage({
            mode: "sessionInfoUpdate",
            participantActive
        });
    }

    // =========================================================================
    // IFRAME ACCESS BUTTON HELPERS (same-origin direct access)
    // =========================================================================

    /**
     * Gets an element from the iframe document by ID.
     * @param {string} id - The element ID
     * @returns {HTMLElement|null}
     */
    _getIframeElement(id) {
        try {
            const iframeDoc = this.appFrame.iframe.contentDocument;
            return iframeDoc?.getElementById(id) || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Gets the iframe's bounding rect in parent coordinates.
     * @returns {DOMRect}
     */
    _getIframeRect() {
        return this.appFrame.iframe.getBoundingClientRect();
    }

    /**
     * Converts a point from parent coordinates to iframe coordinates.
     * @param {Object} p - Point with x, y properties
     * @returns {Object} Point in iframe coordinates
     */
    _toIframeCoords(p) {
        const rect = this._getIframeRect();
        return { x: p.x - rect.left, y: p.y - rect.top };
    }

    /**
     * Converts a point from iframe coordinates to parent coordinates.
     * @param {Object} p - Point with x, y properties
     * @returns {Vector} Point in parent coordinates
     */
    _toParentCoords(p) {
        const rect = this._getIframeRect();
        return new Vector(p.x + rect.left, p.y + rect.top);
    }

    /**
     * Checks if a point (in parent coords) is within the iframe bounds.
     * @param {Object} p - Point with x, y properties
     * @returns {boolean}
     */
    _isPointInIframe(p) {
        const rect = this._getIframeRect();
        return p.x >= rect.left && p.x <= rect.right &&
            p.y >= rect.top && p.y <= rect.bottom;
    }

    /**
     * Handles registration of an iframe access button.
     * Creates a proxy AccessButton that delegates directly to the iframe element (same-origin).
     */
    _message_registerAccessButton(e) {
        const { id, group, order } = e.data;
        console.log("[Debug] Registering access button:", id, group);

        // Remove existing proxy if it exists (cleanup for reloads)
        if (this._iframeAccessButtons.has(id)) {
            const entry = this._iframeAccessButtons.get(id);
            entry.proxy.remove();
            this._iframeAccessButtons.delete(id);
        }

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

        // All proxy methods delegate directly to iframe element via contentDocument

        proxy.getCenter = () => {
            const element = this._getIframeElement(id);
            if (element && typeof element.getCenter === "function") {
                const center = element.getCenter();
                return this._toParentCoords(center);
            }
            return new Vector(0, 0);
        };

        proxy.getIsVisible = () => {
            const element = this._getIframeElement(id);
            if (element && typeof element.getIsVisible === "function") {
                return element.getIsVisible();
            }
        };

        proxy.setHighlight = (isHighlighted) => {
            proxy.toggleAttribute("hover", isHighlighted);
            const element = this._getIframeElement(id);
            if (element && typeof element.setHighlight === "function") {
                element.setHighlight(isHighlighted);
            }
        };

        proxy.isPointInElement = (p) => {
            if (!this._isPointInIframe(p)) return false;

            const element = this._getIframeElement(id);
            if (!element) return false;

            const pIframe = this._toIframeCoords(p);

            if (typeof element.isPointInElement === "function") {
                return element.isPointInElement(pIframe);
            }

        };

        // Handle access-click by delegating to iframe element
        proxy.addEventListener("access-click", (event) => {
            const element = this._getIframeElement(id);
            if (element && typeof element.accessClick === "function") {
                element.accessClick(event.clickMode || "click");
            }
        });

        // Store the proxy (no state cache needed - we access element directly)
        this._iframeAccessButtons.set(id, { proxy });

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
     * Loads app descriptors from the predefined AppsList.
     * @returns {Promise<boolean>} True if at least one app was loaded successfully, false otherwise.
     */
    async loadAppDescriptors() {
        let result = false;
        let apiURL = relURL("./app-base-api.js", import.meta)
        let accessButtonsURL = relURL("../../Utilities/Buttons/access-buttons.js", import.meta)
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
                let participantActive = this.sdata.isUserActive("participant");
                const session_info = {
                    user: this.sdata.me,
                    participantActive,
                };

                // Escape < to prevent </script> from terminating the injection prematurely.
                const safe_session_info = JSON.stringify(session_info).replace(/</g, '\\u003c');
                const injection = [
                    `<script type="module" src="${accessButtonsURL}"></script>`,
                    `<script src="${apiURL}"></script>`,
                    `<base href="${url}/">`,
                    `<script>window.session_info = ${safe_session_info};</script>`
                ].join('\n\t');

                info.html = html.replace(/<head\b[^>]*>/, `$& \n\t${injection}`);

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

            // Listen for changes in session info
            this.sdata.onUser("joined", () => this._sendSessionInfoUpdate());
            this.sdata.onUser("left", () => this._sendSessionInfoUpdate());
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