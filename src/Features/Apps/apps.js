import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { Vector } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { AccessButton } from "../../Utilities/Buttons/access-buttons.js";

const AppsList = [
  "https://cursor-splash.squidly.com.au",
  "https://starfin-adventure.squidly.com.au",
  "https://v3.squidly.com.au/AppsDev/Lamp",
  // "http://127.0.0.1:37374/AppsDev/Lamp", // Local development URL (served by VSCode Live Server)
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
];

class QuizSearch extends SearchWindow {
  constructor(apps) {
    super();
    this.apps = apps;
    this.styles = {
      background: "white",
    };
  }

  reset(imm) {
    this.closeIcon = "close";
    this.resetSearchItems(imm);
  }

  async getSearchResults(searchPhrase) {
    let apps = this.apps;
    /** @type {Answer[]} */
    let items = apps.map((q) => {
      return {
        app: q,
        icon: {
          symbol: q.icon,
          type: "image",
        },
      };
    });
    items = filterAndSort(
      items,
      searchPhrase,
      ({ app: { title, subtitle } }) => [title, subtitle],
    );
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
      },
    });

    this.setGridSize(4, 5);

    this.search = this.createChild(QuizSearch, {
      style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    });
  }

  setGridSize(rows, cols) {
    rows = Math.max(1, Math.min(20, rows || 1));
    cols = Math.max(1, Math.min(20, cols || 1));

    this.nRows = rows;
    this.nCols = cols;

    let grid = new GridLayout(rows, cols);
    grid.styles = {
      position: "absolute",
      top: "var(--gap)",
      left: "var(--gap)",
      right: "var(--gap)",
      bottom: "var(--gap)",
    };
    let closeIcon = grid.add(
      new GridIcon(
        {
          symbol: "close",
          displayValue: "Exit",
          type: "action",
          events: {
            "access-click": async (e) => {
              await this.feature.close();
              // Release toolbar after closing
              this.feature.session.openWindow("default");
            },
          },
        },
        "apps",
      ),
      0,
      0,
    );

    closeIcon.styles = {
      "--shadow-color": "transparent",
      "pointer-events": "all",
    };
    if (this.grid) {
      this.grid.replaceWith(grid);
    } else {
      this.appendChild(grid);
    }
    this.grid = grid;
  }

  // Set iframe src or srcdoc
  async setSrc(src, srcdoc = false) {
    return new Promise((res) => {
      this.iframe.onload = () => {
        res();
      };
      this.iframe.srcdoc = srcdoc ? src : null;
      if (!srcdoc) this.iframe.props = { src };
    });
  }

  // Send Message to iframe
  sendMessage(data) {
    this.iframe.contentWindow.postMessage(data, "*");
  }

  static get usedStyleSheets() {
    return [...SearchWindow.usedStyleSheets, GridIcon.styleSheet];
  }
  static get fixToolBarWhenOpen() {
    return true;
  }
}

export default class Apps extends Features {
  constructor(session, sdata) {
    super(session, sdata);
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

    // RESOURCE LIMITS
    this.MAX_LISTENERS = 100; // Max active listeners per app
    this.WRITE_RATE_LIMIT = 20; // Max writes per second
    this.LISTENER_RATE_LIMIT = 20; // Max listeners per second per app
    this.MAX_BYTES = 1024 * 5; // Max bytes per Firebase write (5KB)
    this.MAX_KEYS = 100; // Max unique keys per app

    this._activeFirebaseListeners = new Map(); // Track active firebase listeners to clear on close
    this._writeCount = 0;
    this._listenerCount = 0;
    this._lastRateReset = Date.now();
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
      this.appFrame.search.show(),
    ]);
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

    // Clear all active firebase listeners
    this._clearAppListeners();

    // Remove settings listeners registered by iframe
    for (const [path, handler] of this._iframeSettingsListeners) {
      this.session.settings.removeEventListener("change", handler);
    }
    this._iframeSettingsListeners.clear();

    await Promise.all([
      this.appFrame.setSrc("about:blank"),
      this.appFrame.hide(),
    ]);
  }

  async _setApp(idx) {
    // Clear all app-added icons before loading new app
    this._clearAppIcons();

    await this.appFrame.setSrc("about:blank");
    if (idx >= 0 && idx < this.appDescriptors.length) {
      this.appFrame.setGridSize(4, 5);
      let app = this.appDescriptors[idx];

      this._clearAppListeners(); // Ensure clean state before loading
      await this.appFrame.setSrc(app.html, true);
      this._sendSessionInfoUpdate();
    }
  }

  _checkRateLimit(type) {
    const now = Date.now();
    if (now - this._lastRateReset > 1000) {
      this._writeCount = 0;
      this._listenerCount = 0;
      this._lastRateReset = now;
    }

    if (type === "write") {
      this._writeCount++;
      if (this._writeCount > this.WRITE_RATE_LIMIT) {
        console.warn(
          `[Rate Limit] Write limit exceeded (${this.WRITE_RATE_LIMIT}/sec). Request dropped.`,
        );
        return false;
      }
    } else if (type === "listener") {
      this._listenerCount++;
      if (this._listenerCount > this.LISTENER_RATE_LIMIT) {
        console.warn(
          `[Rate Limit] Listener creation limit exceeded (${this.LISTENER_RATE_LIMIT}/sec). Request dropped.`,
        );
        return false;
      }
    }
    return true;
  }

  _clearAppListeners() {
    // Unsubscribe from all tracked Firebase listeners
    for (const [path, unsubscribe] of this._activeFirebaseListeners) {
      if (typeof unsubscribe === "function") unsubscribe();
    }
    this._activeFirebaseListeners.clear();

    // Reset counters
    this._writeCount = 0;
    this._listenerCount = 0;
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
        const globalP = this._toParentCoords({ x: data.x, y: data.y });
        event = new MouseEvent(data.type, {
          clientX: globalP.x,
          clientY: globalP.y,
          button: data.button,
          buttons: data.buttons,
          bubbles: true,
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
          repeat: data.repeat,
        });
        break;
    }
    window.dispatchEvent(event);
  }

  _message_log(e) {
    console.log(...e.data.params);
  }

  _message_firebaseSet(e) {
    const { path, value } = e.data;

    // Extract app name from path (first segment, e.g., "Starfin Adventure/score" → "Starfin Adventure")
    const appName = path.split("/")[0];
    if (!appName) {
      console.warn("Firebase set failed: Invalid path (no app name)");
      return;
    }

    // [Security] Verify app name
    const currentApp = this.appDescriptors?.[this.currentAppIndex];
    if (currentApp && currentApp.name !== appName) {
      console.warn(
        `[Security] Blocked attempt to write to app "${appName}" from app "${currentApp.name}"`,
      );
      return;
    }

    // [Rate Limit] Check write frequency
    if (!this._checkRateLimit("write")) return;

    this._performFirebaseSet(path, value, appName);
  }

  _performFirebaseSet(path, value, appName) {
    const registryPath = `appmeta/${appName}/registry`;

    // Check registry to enforce key limit
    this.sdata.get(registryPath).then((registry) => {
      const usedKeys = new Set(registry || []);

      // If this is a new key (not in registry)
      if (!usedKeys.has(path)) {
        // Check limit
        if (usedKeys.size >= this.MAX_KEYS) {
          console.log(
            `Firebase set failed: Too many keys in app "${appName}" (${usedKeys.size}/${this.MAX_KEYS})`,
          );
          return;
        }

        // Add to registry and save
        usedKeys.add(path);
        this.sdata.set(registryPath, Array.from(usedKeys));
      }

      // Block mutable types (Objects and Arrays) to prevent database bloat
      // Only primitives (string, number, boolean, null) are allowed
      if (value !== null && typeof value === "object") {
        console.log(
          `Firebase set failed: Mutable types (Objects and Arrays) are not allowed at path "${path}". Use individual primitive keys instead.`,
        );
        return;
      }

      let serialized = JSON.stringify(value);
      const encoder = new TextEncoder();
      // Check if the serialized value exceeds the maximum size
      if (encoder.encode(serialized).length > this.MAX_BYTES) {
        console.log("Firebase set failed: value is too large");
        return;
      }

      this.sdata.set("appdata/" + path, value);
    });
  }

  _message_firebaseOnValue(e) {
    let path = "appdata/" + e.data.path;

    // [Resource Limit] Check max listeners
    if (this._activeFirebaseListeners.size >= this.MAX_LISTENERS) {
      console.warn(
        `[Resource Limit] Max listeners reached (${this.MAX_LISTENERS}). Request ignored.`,
      );
      return;
    }

    // [Rate Limit] Check creation frequency
    if (!this._checkRateLimit("listener")) return;

    // Remove existing listener for this path if any (avoid dupes)
    if (this._activeFirebaseListeners.has(path)) {
      this._activeFirebaseListeners.get(path)(); // Unsubscribe
    }

    const unsubscribe = this.sdata.onValue(path, (value) => {
      this.appFrame.sendMessage({
        mode: "firebaseOnValueCallback",
        path: e.data.path,
        value: value,
      });
    });

    this._activeFirebaseListeners.set(path, unsubscribe);
  }

  _message_setIcon(e) {
    const { x, y, options, key } = e.data;
    const { nRows, nCols } = this.appFrame;
    if (
      typeof x === "number" &&
      x < nCols &&
      typeof y === "number" &&
      y < nRows &&
      (x > 0 || y > 0)
    ) {
      let icon = new GridIcon(options);
      icon.styles = {
        "--shadow-color": "transparent",
        "pointer-events": "all",
        ...(options.styles || {}),
      };
      this.appFrame.grid.add(icon, x, y);
      icon.events = {
        "access-click": (event) => {
          this.appFrame.sendMessage({
            mode: "onIconClickCallback",
            key: key,
            value: { clickMode: event.clickMode },
          });
        },
      };

      // Track this icon so it can be cleared when switching apps or removed specifically
      this._appIcons.set(key, icon);
    }
  }

  _message_setGridSize(e) {
    this.appFrame.setGridSize(e.data.size[0], e.data.size[1]);
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

    const users = [this.sdata.me, this.sdata.them];
    const inputs = ["mouse", "eyes"];

    users.forEach((user) => {
      inputs.forEach((inputType) => {
        this.session.cursors.addEventListener(`${user}-${inputType}`, (e) => {
          if (this.appFrame?.iframe) {
            const cursorX = e.screenPos._x * window.innerWidth;
            const cursorY = e.screenPos._y * window.innerHeight;

            // Convert window coords to iframe coords (handles offset + scaling)
            const iframeCoords = this._toIframeCoords({
              x: cursorX,
              y: cursorY,
            });

            this.appFrame.sendMessage({
              mode: "cursorUpdate",
              user: `${user}-${inputType}`,
              x: iframeCoords.x,
              y: iframeCoords.y,
              source: user === this.sdata.me ? "local" : "remote",
            });
          }
        });
      });
    });
  }
  _message_setSettings(e) {
    const { path, value } = e.data;
    if (typeof path === "string" && path.startsWith(this.sdata.me + "/")) {
      this.session.settings.setValue(path, value);
    } else {
      console.warn(
        `[Security] Blocked attempt to set setting outside of user scope: ${path}`,
      );
    }
  }

  _message_debugLog(e) {
    // Forward debug logs to console
    if (e.data.level === "error") {
      console.error(
        "[Backend->Iframe]",
        e.data.message,
        ...(e.data.args || []),
      );
    } else if (e.data.level === "warn") {
      console.warn("[Backend->Iframe]", e.data.message, ...(e.data.args || []));
    } else {
      console.log("[Backend->Iframe]", e.data.message, ...(e.data.args || []));
    }
  }

  _message_getSettings(e) {
    const { path, key } = e.data;
    console.log(
      "Received getSettings request for path: " + path + ", key: " + key,
    );

    // Enforce scope
    if (typeof path !== "string" || !path.startsWith(this.sdata.me + "/")) {
      console.warn(
        `[Security] Blocked attempt to get setting outside of user scope: ${path}`,
      );
      // Optionally reply with null or error, or just ignore.
      // Ignoring might hang the caller if they await, but replying null is safer.
      e.source.postMessage(
        {
          mode: "getSettingsResponse",
          key: key,
          path: path,
          value: null,
          error: "Access Denied",
        },
        "*",
      );
      return;
    }

    const value = this.session.settings.get(path);
    console.log(
      "Retrieved value: " + JSON.stringify(value) + " for path: " + path,
    );
    // Send the value back to the iframe
    e.source.postMessage(
      {
        mode: "getSettingsResponse",
        key: key,
        path: path,
        value: value,
      },
      "*",
    );
    console.log("Sent response back to iframe with key: " + key);
  }

  _message_addSettingsListener(e) {
    const path = e.data.path;

    // Enforce scope
    if (typeof path !== "string" || !path.startsWith(this.sdata.me + "/")) {
      console.warn(
        `[Security] Blocked attempt to listen to setting outside of user scope: ${path}`,
      );
      return;
    }

    // Remove existing listener if found (cleanup for reloads)
    if (this._iframeSettingsListeners.has(path)) {
      const oldHandler = this._iframeSettingsListeners.get(path);
      this.session.settings.removeEventListener("change", oldHandler);
    }

    const handler = (event) => {
      if (event.path === path) {
        e.source.postMessage(
          {
            mode: "settingsUpdate",
            path: path,
            value: event.value,
          },
          "*",
        );
      }
    };

    this._iframeSettingsListeners.set(path, handler);
    this.session.settings.addEventListener("change", handler);
  }

  _message_speak(e) {
    const utterance = e.data.utterance;
    this.session.text2speech.speak(utterance);
  }

  _message_loadUtterances(e) {
    const utterances = e.data.utterances;
    this.session.text2speech.loadUtterances(utterances);
  }

  _sendSessionInfoUpdate() {
    if (!this.appFrame?.iframe) return;
    let participantActive = this.sdata.isUserActive("participant");
    this.appFrame.sendMessage({
      mode: "sessionInfoUpdate",
      participantActive,
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
    const scaleX = this.appFrame.iframe.offsetWidth / rect.width;
    const scaleY = this.appFrame.iframe.offsetHeight / rect.height;

    return {
      x: (p.x - rect.left) * scaleX,
      y: (p.y - rect.top) * scaleY,
    };
  }

  /**
   * Converts a point from iframe coordinates to parent coordinates.
   * @param {Object} p - Point with x, y properties
   * @returns {Vector} Point in parent coordinates
   */
  _toParentCoords(p) {
    const rect = this._getIframeRect();
    const scaleX = rect.width / this.appFrame.iframe.offsetWidth;
    const scaleY = rect.height / this.appFrame.iframe.offsetHeight;
    return new Vector(p.x * scaleX + rect.left, p.y * scaleY + rect.top);
  }

  /**
   * Checks if a point (in parent coords) is within the iframe bounds.
   * @param {Object} p - Point with x, y properties
   * @returns {boolean}
   */
  _isPointInIframe(p) {
    const rect = this._getIframeRect();
    return (
      p.x >= rect.left &&
      p.x <= rect.right &&
      p.y >= rect.top &&
      p.y <= rect.bottom
    );
  }

  /**
   * Handles registration of an iframe access button.
   * Creates a proxy AccessButton that delegates directly to the iframe element (same-origin).
   */
  _message_registerAccessButton(e) {
    const { id, group, order } = e.data;
    // Remove existing proxy if it exists (cleanup for reloads)
    if (this._iframeAccessButtons.has(id)) {
      const entry = this._iframeAccessButtons.get(id);
      entry.proxy.remove();
      this._iframeAccessButtons.delete(id);
    }

    // Override the iframe element's coordinate methods so that both the
    // proxy AND direct hits from getButtonAtPoint / dwell detection
    // return parent-viewport coordinates instead of iframe-local ones.
    const element = this._getIframeElement(id);
    if (element) {
      const origGetCenter = element.getCenter.bind(element);
      const origIsPointInElement = element.isPointInElement.bind(element);

      element.getCenter = () => {
        const center = origGetCenter();
        return this._toParentCoords(center);
      };

      element.isPointInElement = (p) => {
        if (!this._isPointInIframe(p)) return false;
        const pIframe = this._toIframeCoords(p);
        return origIsPointInElement(pIframe);
      };
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

    // Proxy methods delegate to the (now-overridden) iframe element methods.
    // No additional coordinate conversion is needed here since the iframe
    // element already returns parent-viewport coordinates after the override.

    proxy.getCenter = () => {
      const el = this._getIframeElement(id);
      if (el && typeof el.getCenter === "function") {
        return el.getCenter();
      }
      return new Vector(0, 0);
    };

    proxy.getIsVisible = () => {
      const el = this._getIframeElement(id);
      if (el && typeof el.getIsVisible === "function") {
        return el.getIsVisible();
      }
    };

    proxy.setHighlight = (isHighlighted) => {
      proxy.toggleAttribute("hover", isHighlighted);
      const el = this._getIframeElement(id);
      if (el && typeof el.setHighlight === "function") {
        el.setHighlight(isHighlighted);
      }
    };

    proxy.isPointInElement = (p) => {
      const el = this._getIframeElement(id);
      if (!el) return false;
      if (typeof el.isPointInElement === "function") {
        return el.isPointInElement(p);
      }
      return false;
    };

    // Handle access-click by delegating to iframe element
    proxy.addEventListener("access-click", (event) => {
      const el = this._getIframeElement(id);
      if (el && typeof el.accessClick === "function") {
        el.accessClick(event.clickMode || "click");
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
    let apiURL = relURL("./app-base-api.js", import.meta);
    let accessButtonsURL = relURL(
      "../../Utilities/Buttons/access-buttons.js",
      import.meta,
    );
    this.appDescriptors = await Promise.all(
      AppsList.map(async (url) => {
        try {
          // Load index and info
          const [resInfo, resIndex] = await Promise.all([
            fetch(url + "/info.json", { cache: "no-store" }),
            fetch(url + "/index.html", { cache: "no-store" }),
          ]);
          if (!resInfo.ok || !resIndex.ok)
            throw new Error("Failed to fetch app descriptor");
          const [info, html] = await Promise.all([
            resInfo.json(),
            resIndex.text(),
          ]);

          info.url = url;
          let participantActive = this.sdata.isUserActive("participant");
          const session_info = {
            user: this.sdata.me,
            participantActive,
            appName: info.name,
          };

          // Escape < to prevent </script> from terminating the injection prematurely.
          const safe_session_info = JSON.stringify(session_info).replace(
            /</g,
            "\\u003c",
          );
          const injection = [
            `<script type="module" src="${accessButtonsURL}"></script>`,
            `<script src="${apiURL}"></script>`,
            `<base href="${url}/">`,
            `<script>window.session_info = ${safe_session_info};</script>`,
          ].join("\n\t");

          info.html = html.replace(/<head\b[^>]*>/, `$& \n\t${injection}`);

          return info;
        } catch (e) {
          console.warn("Failed to load app from " + url, e);
          return null;
        }
      }),
    );

    this.appDescriptors = this.appDescriptors.filter((d) => d !== null);

    if (this.appDescriptors.length > 0) {
      result = true;
      this.appDescriptors = this.appDescriptors.map((item, idx) => {
        item.index = idx;
        return item;
      });
      this.appFrame.search.addEventListener("value", (e) => {
        if (e.value == null) {
          e.waitFor(this.session.openWindow("default"));
        } else {
          // this._setApp(e.value.app.index);
          // this.appFrame.search.hide();
          this.sdata.set("selected_app", {
            index: e.value.app.index,
            app: e.value.app,
            timestamp: Date.now(),
          });
          // We are going to LOG the selected app to the logs which will be saved.
          this.sdata.logChange("app.selected", { value: e.value.app.name });

          this._setApp(e.value.app.index);
          this.appFrame.search.hide();
        }
      });
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
        onSelect: (e) => e.waitFor(this.session.openWindow("apps")),
      });
    }

    this.sdata.onValue("selected_app", async (selectedApp) => {
      // If descriptors failed to load initially, try loading them now
      if (
        (!this.appDescriptors || this.appDescriptors.length === 0) &&
        selectedApp
      ) {
        await this.loadAppDescriptors();
      }

      if (selectedApp) {
        /** Gabriel:
         * The window probably does not have to be open, as it should be open in the first place
         */

        // Ensure the window is open BEFORE loading app content
        // This fixes participant iframe loading by ensuring frame is visible first
        // await this.session.openWindow("apps");
        this.appFrame.search.hide();

        // Use URL for stable lookup across users (index may differ if descriptors loaded in different order)
        const app = this.appDescriptors?.find(
          (a) => a.url === selectedApp.app?.url,
        );
        if (app) {
          this._setApp(app.index);
          this.currentAppIndex = app.index;
        } else {
          // Fallback to index if URL lookup fails
          this._setApp(selectedApp.index);
          this.currentAppIndex = selectedApp.index;
        }
      } else {
        // App was closed by other party
        this.currentAppIndex = null;
        this.appFrame.setSrc("about:blank");

        /** Gabriel:
         * By setting window to default when no app is selected causes the session
         * to go to the default window every time a user joins i.e. it pulls them out
         * of the feature they are in when a user joins. I think its probably best
         * to insead just bring up the search menu again.
         */

        // this.appFrame.hide();
        // If we are currently on the apps screen, go back to default
        // But checking "if (this.session.windowManager.currentWindow === ...)" is hard here
        // safely just trying to open default is usually fine if we are intending to close apps
        // this.session.openWindow("default");
      }
    });

    // Iframe API Message Listener
    window.addEventListener("message", (e) => {
      let modeFunc = "_message_" + e.data?.mode;
      if (modeFunc in this && this[modeFunc] instanceof Function) {
        this[modeFunc](e);
      }
    });

    // Listen for changes in session info
    this.sdata.onUser("joined", () => this._sendSessionInfoUpdate());
    this.sdata.onUser("left", () => this._sendSessionInfoUpdate());
  }

  static get name() {
    return "apps";
  }

  static get layers() {
    return {
      appFrame: {
        type: "area",
        area: "fullAspectArea",
        index: 60,
      },
    };
  }

  static get firebaseName() {
    return "apps";
  }
}
