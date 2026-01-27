["mousemove", "mousedown", "mouseup"].forEach(type => {
    document.addEventListener(type, e => {
        window.parent.postMessage({
            mode: "event",
            emode: "mouse",
            type,
            x: e.clientX,
            y: e.clientY,
            button: e.button,
            buttons: e.buttons
        }, "*");
    });
});
["keydown", "keyup"].forEach(type => {
    document.addEventListener(type, e => {
        window.parent.postMessage({
            mode: "event",
            emode: "key",
            type,
            key: e.key,
            code: e.code,
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            alt: e.altKey,
            meta: e.metaKey,
            repeat: e.repeat
        }, "*");
    });
});


console.log = (...params) => {
    window.parent.postMessage({
        mode: "log",
        params
    }, "*");
}

FIREBASE_ON_VALUE_CALLBACKS = {};
SET_ICON_CALLBACKS = {};
CURSOR_UPDATE_CALLBACK = null;
GET_SETTINGS_CALLBACKS = {};
SETTINGS_LISTENERS = {};
ACCESS_BUTTONS = {};

window.firebaseSet = function (path, value) {
    window.parent.postMessage({
        mode: "firebaseSet",
        path: path,
        value: value
    }, "*");
}

window.firebaseOnValue = function (path, callback) {
    FIREBASE_ON_VALUE_CALLBACKS[path] = callback;
    window.parent.postMessage({
        mode: "firebaseOnValue",
        path: path,
    }, "*");
}

window.setIcon = function (x, y, options, callback) {
    let key = "setIcon_" + Math.random().toString(36).substring(2, 15);
    SET_ICON_CALLBACKS[key] = callback;
    window.parent.postMessage({
        mode: "setIcon",
        key: key,
        x: x,
        y: y,
        options: options,
    }, "*");
}

window.addCursorListener = function (callback) {
    CURSOR_UPDATE_CALLBACK = callback;
    window.parent.postMessage({
        mode: "addCursorListener"
    }, "*");
}

window.setSettings = function (path, value) {
    window.parent.postMessage({
        mode: "setSettings",
        path: path,
        value: value
    }, "*");
}

window.getSettings = function (path, callback) {
    if (!callback) return;
    let key = "getSettings_" + Math.random().toString(36).substring(2, 15);
    GET_SETTINGS_CALLBACKS[key] = callback;
    window.parent.postMessage({
        mode: "getSettings",
        path: path,
        key: key
    }, "*");
}

window.addSettingsListener = function (path, callback) {
    if (!callback) return;
    SETTINGS_LISTENERS[path] = callback;
    window.parent.postMessage({
        mode: "addSettingsListener",
        path: path,
    }, "*");
}

/**
 * Registers an element as an access button with the parent app.
 * @param {HTMLElement} element - The DOM element to register
 * @param {string} group - The access button group name
 * @param {number} [order] - Optional order within the group
 * @returns {string} The generated button ID
 */
window.registerAccessButton = function (element, group, order) {
    if (!(element instanceof HTMLElement)) return null;

    // Generate unique ID if element doesn't have one
    let id = element.id || "access_btn_" + Math.random().toString(36).substring(2, 15);
    if (!element.id) element.id = id;

    // Store element reference
    ACCESS_BUTTONS[id] = {
        element: element,
        group: group,
        order: order
    };

    // Get initial state
    const state = getAccessButtonState(element);

    // Notify parent
    window.parent.postMessage({
        mode: "registerAccessButton",
        id: id,
        group: group,
        order: order,
        ...state
    }, "*");

    return id;
}

/**
 * Unregisters an access button from the parent app.
 * @param {string} id - The button ID to unregister
 */
window.unregisterAccessButton = function (id) {
    if (id in ACCESS_BUTTONS) {
        delete ACCESS_BUTTONS[id];
    }

    window.parent.postMessage({
        mode: "unregisterAccessButton",
        id: id
    }, "*");
}

/**
 * Gets the current state of an access button element.
 * @param {HTMLElement} element - The element to get state for
 * @returns {Object} State object with isVisible, center, bbox
 */
function getAccessButtonState(element) {
    const rect = element.getBoundingClientRect();
    let center = null;
    let isVisible = null;
    let bbox = null;

    // Reuse AccessButtonRoot/AccessButton state
    if (typeof element.getIsVisible === "function") {
        isVisible = element.getIsVisible();
    } else if (typeof element.isVisible === "boolean") {
        isVisible = element.isVisible;
    }

    const c = element.center;
    center = { x: c.x, y: c.y };

    const b = element.bbox;
    if (Array.isArray(b) && b.length === 2) {
        const [pos, size] = b;
        const width = typeof size.x === "number" ? size.x : size.width;
        const height = typeof size.y === "number" ? size.y : size.height;
        bbox = { x: pos.x, y: pos.y, width, height };
    } else {
        bbox = b;
    }

    // if (!center) {
    //     center = {
    //         x: rect.left + rect.width / 2,
    //         y: rect.top + rect.height / 2
    //     };
    // }
    // if (isVisible === null) {
    //     // Check if element is visible (has dimensions and is in viewport)
    //     isVisible = rect.width > 0 && rect.height > 0 &&
    //         rect.bottom > 0 && rect.top < window.innerHeight &&
    //         rect.right > 0 && rect.left < window.innerWidth;
    // }
    // if (!bbox) {
    //     bbox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    // }

    return { isVisible, center, bbox };
}

/**
 * Sends updated state for all registered access buttons to parent.
 */
window.updateAccessButtonStates = function () {
    for (let id in ACCESS_BUTTONS) {
        const entry = ACCESS_BUTTONS[id];
        const state = getAccessButtonState(entry.element);

        window.parent.postMessage({
            mode: "accessButtonState",
            id: id,
            ...state
        }, "*");
    }
}

// Auto-update access button states on resize
window.addEventListener("resize", () => {
    window.updateAccessButtonStates();
});

RESPONSE_FUNCTIONS = {
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
                source: data.source
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
    /**
     * Parent requests current state of an access button.
     */
    getAccessButtonState(data) {
        if (data.id in ACCESS_BUTTONS) {
            const entry = ACCESS_BUTTONS[data.id];
            const state = getAccessButtonState(entry.element);

            window.parent.postMessage({
                mode: "accessButtonState",
                id: data.id,
                requestKey: data.requestKey,
                ...state
            }, "*");
        }
    },
    /**
     * Parent triggers an access-click on a button.
     */
    accessClick(data) {
        console.log("[Debug] iframe received accessClick:", data);
        if (data.id in ACCESS_BUTTONS) {
            const entry = ACCESS_BUTTONS[data.id];
            const element = entry.element;

            // Create event matching AccessClickEvent structure
            const event = new CustomEvent("access-click", {
                bubbles: true,
                cancelable: true
            });
            // Add properties to match AccessClickEvent
            event.clickMode = data.clickMode || "click";
            event.initialEvent = event;
            event.eventPromises = [];
            event.waitFor = function (promise, stopImmediatePropagation = false) {
                if (stopImmediatePropagation) {
                    this.stopImmediatePropagation();
                }
                this.eventPromises.push(promise);
                return promise;
            };
            event.waitAll = function () {
                return Promise.all(this.eventPromises);
            };

            element.dispatchEvent(event);
        }
    },
    /**
     * Parent sets highlight state on a button.
     */
    setAccessButtonHighlight(data) {
        if (data.id in ACCESS_BUTTONS) {
            const entry = ACCESS_BUTTONS[data.id];
            const element = entry.element;

            // Toggle highlight attribute/class
            if (data.highlighted) {
                element.setAttribute("hover", "");
                element.classList.add("access-highlighted");
            } else {
                element.removeAttribute("hover");
                element.classList.remove("access-highlighted");
            }
        }
    }
}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS) {
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
