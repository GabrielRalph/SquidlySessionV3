(function () {
  // Avoid re-declaring if injected multiple times
  if (window.SquidlyAPI) return;

  // Inject grid-icon.css
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://v3.squidly.com.au/src/Utilities/grid-icon.css";

  if (document.currentScript && document.currentScript.src) {
    try {
      link.href = new URL(
        "../../Utilities/Buttons/grid-icon.css",
        document.currentScript.src,
      ).href;
    } catch (e) {}
  }
  document.head.appendChild(link);

  // ============================================================================
  // PRIVATE STATE
  // ============================================================================
  const FIREBASE_ON_VALUE_CALLBACKS = {};
  const SET_ICON_CALLBACKS = {};
  let CURSOR_UPDATE_CALLBACK = null;
  const GET_SETTINGS_CALLBACKS = {};
  const SETTINGS_LISTENERS = {};
  const ACCESS_BUTTONS = {};

  // ============================================================================
  // INPUT FORWARDING
  // ============================================================================
  ["mousemove", "mousedown", "mouseup"].forEach((type) => {
    document.addEventListener(type, (e) => {
      window.parent.postMessage(
        {
          mode: "event",
          emode: "mouse",
          type,
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          buttons: e.buttons,
        },
        "*",
      );
    });
  });

  ["keydown", "keyup"].forEach((type) => {
    document.addEventListener(type, (e) => {
      // Prevent Space/Backspace from triggering native button clicks inside
      // the iframe — these keys are reserved for switch control in the parent.
      if (e.key === " " || e.key === "Backspace") {
        e.preventDefault();
      }

      window.parent.postMessage(
        {
          mode: "event",
          emode: "key",
          type,
          key: e.key,
          code: e.code,
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey,
          repeat: e.repeat,
        },
        "*",
      );
    });
  });

  // ============================================================================
  // CONSOLE OVERRIDE
  // ============================================================================
  console.log = (...params) => {
    window.parent.postMessage(
      {
        mode: "log",
        params,
      },
      "*",
    );
  };

  // ============================================================================
  // INTERNAL HELPERS (ACCESS BUTTONS)
  // ============================================================================

  /**
   * Registers an element as an access button with the parent app.
   * @param {HTMLElement} element - The DOM element to register
   * @param {string} group - The access button group name
   * @param {number} [order] - Optional order within the group
   * @returns {string} The generated button ID
   */
  const registerAccessButton = function (element, group, order) {
    if (!(element instanceof HTMLElement)) return null;

    // Generate unique ID if element doesn't have one
    let id =
      element.id || "access_btn_" + Math.random().toString(36).substring(2, 15);
    if (!element.id) element.id = id;

    // Mark element as registered for auto-unregister tracking
    element.dataset.accessButtonId = id;

    // Store element reference (for local tracking)
    ACCESS_BUTTONS[id] = {
      element: element,
      group: group,
      order: order,
    };

    // Notify parent
    window.parent.postMessage(
      {
        mode: "registerAccessButton",
        id: id,
        group: group,
        order: order,
      },
      "*",
    );

    return id;
  };

  /**
   * Unregisters an access button from the parent app.
   * @param {string} id - The button ID to unregister
   */
  const unregisterAccessButton = function (id) {
    if (id in ACCESS_BUTTONS) {
      delete ACCESS_BUTTONS[id];
    }

    window.parent.postMessage(
      {
        mode: "unregisterAccessButton",
        id: id,
      },
      "*",
    );
  };

  /**
   * Automatically registers an access-button element using its attributes.
   * @param {HTMLElement} element - The access-button element
   */
  function autoRegisterAccessButton(element) {
    // Skip if already registered
    if (element.dataset.accessButtonId) return;

    const group = element.getAttribute("access-group") || "default";
    const orderAttr = element.getAttribute("access-order");
    const order = orderAttr !== null ? parseFloat(orderAttr) : undefined;

    registerAccessButton(element, group, order);
  }

  /**
   * Automatically unregisters an access-button element.
   * @param {HTMLElement} element - The access-button element
   */
  function autoUnregisterAccessButton(element) {
    if (element.dataset.accessButtonId) {
      unregisterAccessButton(element.dataset.accessButtonId);
    }
  }

  // ============================================================================
  // PUBLIC API (window.SquidlyAPI)
  // ============================================================================
  window.SquidlyAPI = {
    firebaseSet: function (path, value) {
      // Auto-prepend appName to namespace all Firebase paths per app
      const appName = window.session_info?.appName;
      const fullPath = appName ? `${appName}/${path}` : path;

      window.parent.postMessage(
        {
          mode: "firebaseSet",
          path: fullPath,
          value: value,
        },
        "*",
      );
    },

    firebaseOnValue: function (path, callback) {
      // Auto-prepend appName to match firebaseSet namespacing
      const appName = window.session_info?.appName;
      const fullPath = appName ? `${appName}/${path}` : path;

      // Store callback under full path (parent sends back full path)
      FIREBASE_ON_VALUE_CALLBACKS[fullPath] = callback;
      window.parent.postMessage(
        {
          mode: "firebaseOnValue",
          path: fullPath,
        },
        "*",
      );
    },

    setIcon: function (x, y, options, callback) {
      let key = "setIcon_" + Math.random().toString(36).substring(2, 15);
      SET_ICON_CALLBACKS[key] = callback;
      window.parent.postMessage(
        {
          mode: "setIcon",
          key: key,
          x: x,
          y: y,
          options: options,
        },
        "*",
      );
      return key;
    },

    setGridSize: function (rows, cols) {
      window.parent.postMessage(
        {
          mode: "setGridSize",
          size: [rows, cols],
        },
        "*",
      );
    },

    removeIcon: function (key) {
      if (key in SET_ICON_CALLBACKS) {
        delete SET_ICON_CALLBACKS[key];
      }
      window.parent.postMessage(
        {
          mode: "removeIcon",
          key: key,
        },
        "*",
      );
    },

    addCursorListener: function (callback) {
      CURSOR_UPDATE_CALLBACK = callback;
      window.parent.postMessage(
        {
          mode: "addCursorListener",
        },
        "*",
      );
    },

    setSettings: function (path, value) {
      window.parent.postMessage(
        {
          mode: "setSettings",
          path: path,
          value: value,
        },
        "*",
      );
    },

    getSettings: function (path, callback) {
      if (!callback) return;
      let key = "getSettings_" + Math.random().toString(36).substring(2, 15);
      GET_SETTINGS_CALLBACKS[key] = callback;
      window.parent.postMessage(
        {
          mode: "getSettings",
          path: path,
          key: key,
        },
        "*",
      );
    },

    addSettingsListener: function (path, callback) {
      if (!callback) return;
      SETTINGS_LISTENERS[path] = callback;
      window.parent.postMessage(
        {
          mode: "addSettingsListener",
          path: path,
        },
        "*",
      );
    },

    addSessionInfoListener: function (callback) {
      if (!callback) return;
      if (window.session_info) callback(window.session_info);
      window.addEventListener("sessionInfoUpdate", (e) => callback(e.detail));
    },

    loadUtterances: function (utterances) {
      window.parent.postMessage(
        {
          mode: "loadUtterances",
          utterances: utterances,
        },
        "*",
      );
    },

    speak: function (utterance) {
      window.parent.postMessage(
        {
          mode: "speak",
          utterance: utterance,
        },
        "*",
      );
    },

    registerAccessButton: registerAccessButton,
    unregisterAccessButton: unregisterAccessButton,
  };

  // ============================================================================
  // AUTO-REGISTRATION OBSERVER
  // ============================================================================
  const accessButtonObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.tagName === "ACCESS-BUTTON") {
          autoRegisterAccessButton(node);
        }
        // Also check descendants
        node
          .querySelectorAll?.("access-button")
          .forEach(autoRegisterAccessButton);
      }

      // Handle removed nodes
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.tagName === "ACCESS-BUTTON") {
          autoUnregisterAccessButton(node);
        }
        node
          .querySelectorAll?.("access-button")
          .forEach(autoUnregisterAccessButton);
      }
    }
  });

  function startAccessButtonObserver() {
    accessButtonObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    // Register any existing access-button elements
    document
      .querySelectorAll("access-button")
      .forEach(autoRegisterAccessButton);
  }

  // Start observer when DOM is ready
  if (document.body) {
    startAccessButtonObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startAccessButtonObserver);
  }

  // ============================================================================
  // MESSAGE RESPONSE HANDLERS
  // ============================================================================
  const RESPONSE_FUNCTIONS = {
    firebaseOnValueCallback(data) {
      if (data.path in FIREBASE_ON_VALUE_CALLBACKS) {
        FIREBASE_ON_VALUE_CALLBACKS[data.path](data.value);
      }
    },
    onIconClickCallback(data) {
      if (data.key in SET_ICON_CALLBACKS) {
        SET_ICON_CALLBACKS[data.key](data.value);
      }
    },
    cursorUpdate(data) {
      if (CURSOR_UPDATE_CALLBACK) {
        CURSOR_UPDATE_CALLBACK({
          user: data.user,
          x: data.x,
          y: data.y,
          source: data.source,
        });
      }
    },
    getSettingsResponse(data) {
      if (data.key in GET_SETTINGS_CALLBACKS) {
        GET_SETTINGS_CALLBACKS[data.key](data.value);
        delete GET_SETTINGS_CALLBACKS[data.key];
      }
    },
    settingsUpdate(data) {
      if (data.path in SETTINGS_LISTENERS) {
        SETTINGS_LISTENERS[data.path](data.value);
      }
    },
    sessionInfoUpdate(data) {
      if (window.session_info) {
        const { mode, ...updates } = data;
        Object.assign(window.session_info, updates);
        window.dispatchEvent(
          new CustomEvent("sessionInfoUpdate", {
            detail: window.session_info,
          }),
        );
      }
    },
  };

  window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS) {
      RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
  });

  // ============================================================================
  // AUTO-SYNC DISPLAY SETTINGS
  // ============================================================================
  const startDisplaySync = () => {
    const updateBody = (type, value) => {
      if (type === "font") {
        document.body.setAttribute("font", value || "inclusive");
      }
    };

    window.SquidlyAPI.addSessionInfoListener((info) => {
      if (info.user) {
        // Initial fetch
        window.SquidlyAPI.getSettings(`${info.user}/display/font`, (val) =>
          updateBody("font", val),
        );
        // Subscription for updates
        window.SquidlyAPI.addSettingsListener(
          `${info.user}/display/font`,
          (val) => updateBody("font", val),
        );
      }
    });
  };

  // Initialize display sync
  if (document.body) startDisplaySync();
  else document.addEventListener("DOMContentLoaded", startDisplaySync);
})();
