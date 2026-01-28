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
 * Parent will access the element directly via contentDocument (same-origin).
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

    // Store element reference (for local tracking)
    ACCESS_BUTTONS[id] = {
        element: element,
        group: group,
        order: order
    };

    // Notify parent - it will access the element directly via getElementById
    window.parent.postMessage({
        mode: "registerAccessButton",
        id: id,
        group: group,
        order: order
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

// Note: State syncing (getAccessButtonState, updateAccessButtonStates) is no longer needed.
// Parent accesses iframe elements directly via contentDocument (same-origin).

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

// Response handlers for messages from parent
// Note: Access button methods (setHighlight, accessClick, isPointInElement) are handled
// directly by parent via contentDocument access (same-origin), not via message passing.
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
    }
}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS) {
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
