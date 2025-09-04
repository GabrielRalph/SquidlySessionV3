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