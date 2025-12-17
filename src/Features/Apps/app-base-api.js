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

window.firebaseSet = function(path, value){
    window.parent.postMessage({
        mode: "firebaseSet",
        path: path,
        value: value
    }, "*");
}

window.firebaseOnValue = function(path, callback){
    FIREBASE_ON_VALUE_CALLBACKS[path] = callback;
    window.parent.postMessage({
        mode: "firebaseOnValue",
        path: path,
    }, "*");
}

window.setIcon = function(x, y, options, callback){
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

window.addCursorListener = function(callback){
    CURSOR_UPDATE_CALLBACK = callback;
    window.parent.postMessage({
        mode: "addCursorListener"
    }, "*");
}

window.setSettings = function(path, value){
    window.parent.postMessage({
        mode: "setSettings",
        path: path,
        value: value
    }, "*");
}

window.getSettings = function(path, callback){
    if (!callback) return;
    let key = "getSettings_" + Math.random().toString(36).substring(2, 15);
    GET_SETTINGS_CALLBACKS[key] = callback;
    window.parent.postMessage({
        mode: "getSettings",
        path: path,
        key: key
    }, "*");
}

window.addSettingsListener = function(path, callback){
    if (!callback) return;
    SETTINGS_LISTENERS[path] = callback;
    window.parent.postMessage({
        mode: "addSettingsListener",
        path: path,
    }, "*");
}

RESPONSE_FUNCTIONS = {
    firebaseOnValueCallback(data){
        if (data.path in FIREBASE_ON_VALUE_CALLBACKS){
            FIREBASE_ON_VALUE_CALLBACKS[data.path](data.value);
        }
    },
    onIconClickCallback(data){
        if (data.key in SET_ICON_CALLBACKS){
            SET_ICON_CALLBACKS[data.key](data.value);
        }
    },
    cursorUpdate(data){
        if (CURSOR_UPDATE_CALLBACK){
            CURSOR_UPDATE_CALLBACK({
                user: data.user,
                x: data.x,
                y: data.y,
                source: data.source
            });
        }
    },
    getSettingsResponse(data){
        if (data.key in GET_SETTINGS_CALLBACKS){
            GET_SETTINGS_CALLBACKS[data.key](data.value);
            delete GET_SETTINGS_CALLBACKS[data.key];
        }
    },
    settingsUpdate(data){
        if (data.path in SETTINGS_LISTENERS){
            SETTINGS_LISTENERS[data.path](data.value);
        }
    }
}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS){
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
