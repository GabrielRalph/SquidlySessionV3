import { set } from "../../Firebase/firebase.js";
import { Vector } from "../../SvgPlus/vector.js";
import { addDeviceChangeCallback } from "../../Utilities/device-manager.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";

class MuteEvent extends Event {
    constructor(type, user) {
        super("mute");
        this.track = type;
        this.user = user;
    }
}

class VideoDisplay extends HideShowTransition {
    
    constructor(el = "video-display") {
        super(el);

        this._aspect = 0;
        this.class = "video-display"
        this.styles = {
            position: "relative",
        }

        this.canvas = this.createChild("canvas");
        this.ctx = this.canvas.getContext("2d", {willReadFrequently: true});

        this.videoOverlay = this.createChild("div", {class: "video-overlay"})
        this.overlayImage = this.videoOverlay.createChild("div", {class: "overlay-image"});
        let loader = this.videoOverlay.createChild("div", {class: "simple-loader"});
        loader.createChild("b");
        loader.createChild("b");
        loader.createChild("b");


        this.topLeft = this.createChild("div", {
            class: "icon-slot top-left",
            styles: {
                position: "absolute",
                top: 0,
                left: 0
            }
        });
        this.audioMute = this.topLeft.createChild("div", {class: "icon-button"});
        this.videoMute = this.topLeft.createChild("div", {class: "icon-button"});

        this.topRight = this.createChild("div", {
            class: "icon-slot top-right",
            styles: {
                position: "absolute",
                top: 0,
                right: 0
            }
        });

        this.bottomRight = this.createChild("div", {
            class: "icon-slot name",
            styles: {
                position: "absolute",
                bottom: 0,
                left: 0
            }
        });

        this.bottomLeft = this.createChild("div", {
            class: "icon-slot",
            styles: {
                position: "absolute",
                bottom: 0,
                left: 0
            }
        });
    }

    _update(mode){
        this.dispatchEvent(new MuteEvent(mode, null))
    }


    set waiting(bool) {
        this.toggleAttribute("waiting", bool);
    }
    get waiting() {
        return this.hasAttribute("waiting");
    }

    /**
     * @param {boolean} value
     */
    set video_muted(value) {
        this.toggleAttribute("disabled", false);
        if (value === false) {
            this.setIcon("videoMute", "video", () => this._update("video"));
        } else if (value === true) {
            this.toggleAttribute("disabled", true);
            this.setIcon("videoMute", "novideo", () => this._update("video"));
        } else {
            this.setIcon("videoMute", null);
        }
        this._video_muted = value;
    }

    /**
     * @param {boolean} value
     */
    set audio_muted(value) {
        if (value === false) {
            this.setIcon("audioMute", "unmute", () => this._update("audio"));
        } else if (value === true) {
            this.setIcon("audioMute", "mute", () => this._update("audio"));
        } else {
            this.setIcon("audioMute", null);
        }
    }


    setIcon(location, iconName, cb) {
        if (iconName == null) {
            this[location].innerHTML = "";
            this[location].onclick = null;
        } else {
            this[location].innerHTML = "";
            this[location].createChild(Icon, {events: {click: () => {
                this[location].onclick = () => {
                    if (cb instanceof Function) cb();
                }
            }}}, iconName);
        }
    }


    captureFrame(video) {
        const { videoWidth, videoHeight } = video;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            this.waiting = false;
            this._aspect = videoWidth / videoHeight;
            this.styles = {
                "--aspect": this.aspect
            }
            if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
                this.dispatchEvent(new Event("aspect"));
            }
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            this.ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        }
    }

    emptyFrame() {
        this._aspect = 0;
        this.styles = {
            "--aspect": this.aspect
        }
        this.canvas.width = 1;
        this.canvas.height = 1;
        this.ctx.clearRect(0, 0, 1, 1);
        this.dispatchEvent(new Event("aspect"));
    }

    set userName(name) {
        this.bottomLeft.innerHTML = "";
        this.bottomLeft.createChild("div", {
            class: "icon-text", 
            content: name
        })
    }

    set userImage(url) {
        if (typeof url === "string" && url !== "") {
            this.overlayImage.styles = {
                "background-image": `url("${url}")`
            }
        } else {
            this.overlayImage.styles = {
                "background-image": null
            }
        }
    }

    set isTalking(bool) {
        this.toggleAttribute("talking", bool);
    }
 
    get aspect(){
        let aspect = this._aspect;
        if (typeof aspect !== "number" || Number.isNaN(aspect)) {
            aspect = 0;
        }
        return aspect;
    }

}


const stackModes = {
    "vertical-height": (a1, a2, w, h, space) => [ (h - space) / (1/a1 + 1/a2), h ],
    "vertical-width": (a1, a2, w, h, space) => [ w, (w / a1) + (w / a2) + space ],
    "horizontal-width": (a1, a2, w, h, space) => [ w, (w - space) / (a1 + a2) ],
    "horizontal-height": (a1, a2, w, h, space) => [ h * a1 + h * a2 + space, h ],
}
    
export class VideoPanelWidget extends ShadowElement {
    /** @type {VideoDisplay} */
    host = null;

    /** @type {VideoDisplay} */
    participant = null;

    border = 2;

    constructor() {
        super("video-panel-widget");

        this.stack = this.createChild("div", {class: "stack"})

        this.participant = this.stack.createChild(VideoDisplay, {events: {
            aspect: this._update_layout.bind(this),
            mute: (e) => this.dispatchEvent(new MuteEvent(e.track, "participant")),
        }});
        this.participant.userName = "participant";

        this.host = this.stack.createChild(VideoDisplay, {events: {
            aspect: this._update_layout.bind(this),
            mute: (e) => this.dispatchEvent(new MuteEvent(e.track, "host")),
        }});
        this.host.userName = "host";


        let robs = new ResizeObserver(() => {
            this._update_layout()
        })
        robs.observe(this.root);
    }

    _update_layout() {
        let aspectA = this.host.aspect;
        let aspectB = this.participant.aspect;

        let fullHeight = this.clientHeight - 2 * this.border;
        let fullWidth = this.clientWidth - 2 * this.border;

        this.host.shown = aspectA > 0;
        this.participant.shown = aspectB > 0;
        
        let layouts = Object.keys(stackModes).map(mode => {
            let [w, h] = stackModes[mode](aspectA, aspectB, fullWidth, fullHeight, this.border);
            let area = w * h;
            let valid = (w <= fullWidth) && (h <= fullHeight);
            return {mode, w, h, area, valid};
        });

        layouts.sort((a, b) => b.area - a.area);
        layouts = layouts.filter(l => l.valid);
        
        let choice = layouts[0];
        this.stack.styles = {
            "--s-width": choice.w + "px",
            "--s-height": choice.h + "px",
        }
        this.stack.setAttribute("stack-mode", choice.mode);
    }


    static get usedStyleSheets(){
        return [relURL("./style.css", import.meta)]
    }
}