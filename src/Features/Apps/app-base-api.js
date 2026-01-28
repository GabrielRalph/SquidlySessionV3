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

    // Use AccessButtonRoot methods if available (for <access-button> elements)
    if (typeof element.getCenter === "function") {
        const c = element.getCenter();
        center = { x: c.x, y: c.y };
    } else {
        center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }

    if (typeof element.getIsVisible === "function") {
        isVisible = element.getIsVisible();
    } else {
        // Fallback: check if element has non-zero size and is within viewport
        isVisible = rect.width > 0 && rect.height > 0 &&
            rect.bottom > 0 && rect.right > 0 &&
            rect.top < window.innerHeight && rect.left < window.innerWidth;
    }

    // bbox is not provided by AccessButtonRoot, always use bounding rect
    bbox = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

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

// ============================================================================
// AUTO-REGISTRATION FOR <access-button> ELEMENTS
// ============================================================================

/**
 * Automatically registers an access-button element using its attributes.
 * @param {HTMLElement} element - The access-button element
 */
function autoRegisterAccessButton(element) {
    // Skip if already registered
    if (element.dataset.accessButtonId) return;
    
    const group = element.getAttribute('access-group') || 'default';
    const orderAttr = element.getAttribute('access-order');
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

/**
 * MutationObserver callback to watch for access-button additions/removals.
 */
const accessButtonObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        // Handle added nodes
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            
            if (node.tagName === 'ACCESS-BUTTON') {
                autoRegisterAccessButton(node);
            }
            // Also check descendants
            node.querySelectorAll?.('access-button').forEach(autoRegisterAccessButton);
        }
        
        // Handle removed nodes
        for (const node of mutation.removedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            
            if (node.tagName === 'ACCESS-BUTTON') {
                autoUnregisterAccessButton(node);
            }
            node.querySelectorAll?.('access-button').forEach(autoUnregisterAccessButton);
        }
    }
});

/**
 * Starts observing the DOM for access-button elements.
 */
function startAccessButtonObserver() {
    accessButtonObserver.observe(document.body, { childList: true, subtree: true });
    // Register any existing access-button elements
    document.querySelectorAll('access-button').forEach(autoRegisterAccessButton);
}

// Start observer when DOM is ready
if (document.body) {
    startAccessButtonObserver();
} else {
    document.addEventListener('DOMContentLoaded', startAccessButtonObserver);
}

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

            // Delegate to element.accessClick if available (e.g. <access-button>)
            if (typeof element.accessClick === "function") {
                element.accessClick(data.clickMode || "click");
            } else {
                // Fallback for plain HTML elements
                const event = new CustomEvent("access-click", {
                    bubbles: true,
                    cancelable: true
                });
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
        }
    },
    /**
     * Parent sets highlight state on a button.
     */
    setAccessButtonHighlight(data) {
        if (data.id in ACCESS_BUTTONS) {
            const entry = ACCESS_BUTTONS[data.id];
            const element = entry.element;

            // Delegate to element.setHighlight if available (e.g. <access-button>)
            if (typeof element.setHighlight === "function") {
                element.setHighlight(data.highlighted);
            } else {
                // Fallback for plain HTML elements
                if (data.highlighted) {
                    element.setAttribute("hover", "");
                    element.classList.add("access-highlighted");
                } else {
                    element.removeAttribute("hover");
                    element.classList.remove("access-highlighted");
                }
            }
        }
    },
    /**
     * Parent checks if a point is inside an access button element.
     * Used for eye gaze hit-testing.
     */
    isPointInElement(data) {
        const { id, x, y, requestKey } = data;
        let result = false;

        if (id in ACCESS_BUTTONS) {
            const entry = ACCESS_BUTTONS[id];
            const element = entry.element;

            // Delegate to element.isPointInElement if available (e.g. <access-button>)
            if (typeof element.isPointInElement === "function") {
                // Create a point object with x, y properties
                const p = { x, y };
                result = element.isPointInElement(p);
            } else {
                // Fallback for plain HTML elements: check if point is in bounding rect
                const rect = element.getBoundingClientRect();
                result = x >= rect.left && x <= rect.right &&
                         y >= rect.top && y <= rect.bottom;
            }
        }

        window.parent.postMessage({
            mode: "isPointInElementResponse",
            id: id,
            requestKey: requestKey,
            result: result
        }, "*");
    }
}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS) {
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
