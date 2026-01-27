// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

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

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

FIREBASE_ON_VALUE_CALLBACKS = {};
SET_ICON_CALLBACKS = {};
CURSOR_UPDATE_CALLBACK = null;
GET_SETTINGS_CALLBACKS = {};
SETTINGS_LISTENERS = {};
ACCESS_BUTTONS = {};

// Auto-registration API (exposed by IIFE below)
let autoRegistrationAPI = null;

// ============================================================================
// PUBLIC API (window.* functions)
// ============================================================================

console.log = (...params) => {
    window.parent.postMessage({
        mode: "log",
        params
    }, "*");
}

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

    // Check if already auto-registered - return existing ID to avoid duplicates
    const existingId = autoRegistrationAPI?.getRegisteredId(element);
    if (existingId && existingId in ACCESS_BUTTONS) {
        // Update order if provided and different
        if (order !== undefined && ACCESS_BUTTONS[existingId].order !== order) {
            ACCESS_BUTTONS[existingId].order = order;
            // Notify parent of order change
            const state = getAccessButtonState(element);
            window.parent.postMessage({
                mode: "registerAccessButton",
                id: existingId,
                group: group,
                order: order,
                ...state
            }, "*");
        }
        return existingId;
    }

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

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the current state of an access button element.
 * Visibility is calculated by the parent window, not here.
 * @param {HTMLElement} element - The element to get state for
 * @returns {Object} State object with center and bbox
 */
function getAccessButtonState(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return {
        center: { x: centerX, y: centerY },
        bbox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    };
}

// ============================================================================
// AUTO-REGISTRATION SYSTEM
// ============================================================================
// Encapsulated in IIFE to keep implementation details private

(function setupAutoRegistration() {
    /**
     * WeakMap to track elements that have been auto-registered.
     * Maps HTMLElement -> buttonId string
     * @type {WeakMap<HTMLElement, string>}
     */
    const AUTO_REGISTERED_ELEMENTS = new WeakMap();

    /**
     * Flag to track if a state update is pending (for debouncing)
     * @type {boolean}
     */
    let _pendingStateUpdate = false;

    /**
     * Checks if an element should be auto-registered based on data attributes.
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if element has data-access-button attribute
     */
    function shouldAutoRegister(element) {
        return element instanceof HTMLElement &&
            element.hasAttribute("data-access-button") &&
            !AUTO_REGISTERED_ELEMENTS.has(element);
    }

    /**
     * Auto-registers an element if it has the data-access-button attribute.
     * @param {HTMLElement} element - Element to register
     */
    function autoRegisterElement(element) {
        if (!shouldAutoRegister(element)) return;

        const group = element.getAttribute("data-access-button");
        const orderAttr = element.getAttribute("data-access-button-order");
        const order = orderAttr !== null ? parseInt(orderAttr, 10) : undefined;

        // Register using existing function
        const buttonId = window.registerAccessButton(element, group, order);

        // Track in WeakMap
        if (buttonId) {
            AUTO_REGISTERED_ELEMENTS.set(element, buttonId);
        }
    }

    /**
     * Auto-unregisters an element if it was auto-registered.
     * @param {HTMLElement} element - Element to unregister
     */
    function autoUnregisterElement(element) {
        if (!(element instanceof HTMLElement)) return;

        const buttonId = AUTO_REGISTERED_ELEMENTS.get(element);
        if (buttonId) {
            window.unregisterAccessButton(buttonId);
            AUTO_REGISTERED_ELEMENTS.delete(element);
        }
    }

    /**
     * Debounced state update function using requestAnimationFrame.
     * Batches multiple DOM mutations into a single state update.
     */
    function scheduleStateUpdate() {
        if (_pendingStateUpdate) return;

        _pendingStateUpdate = true;
        requestAnimationFrame(() => {
            window.updateAccessButtonStates();
            _pendingStateUpdate = false;
        });
    }

    /**
     * Recursively finds all elements with data-access-button attribute in a node tree.
     * @param {Node} node - Root node to search from
     * @returns {HTMLElement[]} Array of elements with data-access-button
     */
    function findAccessButtonElements(node) {
        const elements = [];

        if (node instanceof HTMLElement) {
            if (node.hasAttribute("data-access-button")) {
                elements.push(node);
            }
            // Also search children
            for (const child of node.children) {
                elements.push(...findAccessButtonElements(child));
            }
        }

        return elements;
    }

    /**
     * Handles DOM mutations for auto-registration.
     * @param {MutationRecord[]} mutations - Array of mutation records
     */
    function handleMutations(mutations) {
        let needsStateUpdate = false;

        for (const mutation of mutations) {
            // Handle added nodes
            if (mutation.addedNodes) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        // Check the node itself
                        if (shouldAutoRegister(node)) {
                            autoRegisterElement(node);
                            needsStateUpdate = true;
                        }
                        // Check all descendants
                        const descendants = findAccessButtonElements(node);
                        for (const element of descendants) {
                            if (shouldAutoRegister(element)) {
                                autoRegisterElement(element);
                                needsStateUpdate = true;
                            }
                        }
                    }
                }
            }

            // Handle removed nodes
            if (mutation.removedNodes) {
                for (const node of mutation.removedNodes) {
                    if (node instanceof HTMLElement) {
                        // Check the node itself
                        autoUnregisterElement(node);
                        // Check all descendants
                        const descendants = findAccessButtonElements(node);
                        for (const element of descendants) {
                            autoUnregisterElement(element);
                        }
                        needsStateUpdate = true;
                    }
                }
            }

            // Handle attribute changes (e.g., data-access-button added/removed)
            if (mutation.type === "attributes") {
                const target = mutation.target;
                if (target instanceof HTMLElement) {
                    if (mutation.attributeName === "data-access-button") {
                        if (target.hasAttribute("data-access-button")) {
                            // Attribute was added or changed
                            if (shouldAutoRegister(target)) {
                                autoRegisterElement(target);
                                needsStateUpdate = true;
                            }
                        } else {
                            // Attribute was removed
                            autoUnregisterElement(target);
                            needsStateUpdate = true;
                        }
                    } else if (mutation.attributeName === "data-access-button-order") {
                        // Order changed - re-register to update order
                        if (target.hasAttribute("data-access-button")) {
                            const existingId = AUTO_REGISTERED_ELEMENTS.get(target);
                            if (existingId) {
                                // Unregister and re-register to update order
                                window.unregisterAccessButton(existingId);
                                AUTO_REGISTERED_ELEMENTS.delete(target);
                                autoRegisterElement(target);
                                needsStateUpdate = true;
                            }
                        }
                    } else {
                        // Other attribute changes might affect visibility/position
                        if (AUTO_REGISTERED_ELEMENTS.has(target)) {
                            needsStateUpdate = true;
                        }
                    }
                }
            }
        }

        // Schedule state update if needed
        if (needsStateUpdate) {
            scheduleStateUpdate();
        }
    }

    /**
     * Initializes the MutationObserver and registers existing elements.
     */
    function initializeObserver() {
        const observer = new MutationObserver(handleMutations);

        const startObserving = () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-access-button", "data-access-button-order"]
            });

            // Register any existing elements with data-access-button
            const existingElements = findAccessButtonElements(document.body);
            for (const element of existingElements) {
                if (shouldAutoRegister(element)) {
                    autoRegisterElement(element);
                }
            }
            if (existingElements.length > 0) {
                scheduleStateUpdate();
            }
        };

        // Start observing when DOM is ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", startObserving);
        } else {
            // DOM already loaded
            startObserving();
        }
    }

    // Expose minimal API for registerAccessButton to check existing registrations
    autoRegistrationAPI = {
        getRegisteredId: (element) => AUTO_REGISTERED_ELEMENTS.get(element)
    };

    // Initialize when DOM is ready (script may run in <head> before body exists)
    if (typeof MutationObserver !== "undefined") {
        if (document.body) {
            initializeObserver();
        } else {
            // Wait for DOM to be ready
            document.addEventListener("DOMContentLoaded", initializeObserver);
        }
    }
})();

// ============================================================================
// EVENT HANDLERS AND RESPONSE FUNCTIONS
// ============================================================================

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
