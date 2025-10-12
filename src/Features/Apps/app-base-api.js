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

function firebaseSet(path, value){
    window.parent.postMessage({
        mode: "firebaseSet",
        path: path,
        value: value
    }, "*");
}

function firebaseOnValue(path, callback){
    FIREBASE_ON_VALUE_CALLBACKS[path] = callback;
    window.parent.postMessage({
        mode: "firebaseOnValue",
        path: path,
    }, "*");
}

function setIcon(x, y, options, callback){
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

function addCursorListener(callback){
    CURSOR_UPDATE_CALLBACK = callback;
    window.parent.postMessage({
        mode: "addCursorListener"
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
    }

}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS){
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
