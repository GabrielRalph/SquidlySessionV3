import { Vector } from "../../SvgPlus/vector.js";
import { HideShow } from "../../Utilities/hide-show.js";
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

class VideoDisplay extends HideShow {
    _aspect = null;
    border = 0;
    constructor(el = "video-display") {
        super(el);
        this.class = "video-display"
        this.styles = {
            position: "relative",
        }
        this.video = this.createChild("video", {autoplay: true, playsinline: true});

        this.videoOverlay = this.createChild("div", {class: "video-overlay"})
        this.overlayImage = this.videoOverlay.createChild("div", {class: "overlay-image"});
        this.createChild("div", {class: "border-overlay"});

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

    applyHiddenState() {
        this.styles = {
            "display": "none",
        }
    }

    applyShownState() {
        this.styles = {
            "display": null,
        }
    }

    update(mode){
        this.dispatchEvent(new MuteEvent(mode, null))
    }

    /**
     * @param {boolean} value
     */
    set video_muted(value) {
        this.toggleAttribute("disabled", false);
        if (value === false) {
            this.setIcon("videoMute", "video", () => this.update("video"));
        } else if (value === true) {
            this.toggleAttribute("disabled", true);
            this.setIcon("videoMute", "novideo", () => this.update("video"));
        } else {
            this.setIcon("videoMute", null);
        }
    }

    /**
     * @param {boolean} value
     */
    set audio_muted(value) {
        if (value === false) {
            this.setIcon("audioMute", "unmute", () => this.update("audio"));
        } else if (value === true) {
            this.setIcon("audioMute", "mute", () => this.update("audio"));
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

    async waitForVideoSize() {
        let size = null;
        let i = 0;
        let src = this.srcObject;
        while (size == null && i < 1000) {
            try {
                let settings = src.getVideoTracks()[0].getSettings();
                let ratio = (this.border + settings.width) / (this.border + settings.height);
                if (!Number.isNaN(ratio)) {
                    size = ratio;
                } else {
                    size = null;
                }
                await delay(50);
            } catch (e) {
                size = null
            }
            i++;
        }
        this._aspect = size;
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
        this.overlayImage.styles = {
            "background-image": `url("${url}")`
        }
    }

    set isTalking(bool) {
        this.toggleAttribute("talking", bool);
    }
  
    /** @param {boolean} bool*/
    set hide(bool){
        this.toggleAttribute("hide", bool);
    }

    /** @param {boolean} val*/
    set muted(val) {
        this.video.muted = val;
    }
  
    get aspect(){
        let aspect = this._aspect;
        if (aspect === null || Number.isNaN(aspect)) aspect = 0;
        return aspect;
    }

    set srcObject(src) {
        // console.log("SRC:", src);
        
        this.video.srcObject = src;
        this.waitForVideoSize();
    }

    get srcObject() { return this.video.srcObject; }


    set size(v) {
        this.styles = {
            "--width": v.x + "px",
            "--height": v.y + "px",
        }
    }

}


export class VideoPanelWidget extends ShadowElement {
    /** @type {VideoDisplay} */
    host = null;

     /** @type {VideoDisplay} */
     participant = null;

    constructor() {
        super("video-panel-widget");
        this.stack = this.createChild("div", {class: "stack"})

        this.participant = this.stack.createChild(VideoDisplay, {events: {
            aspect: this.updateLayout.bind(this),
            mute: (e) => this.dispatchEvent(new MuteEvent(e.track, "participant")),
        }});
        this.participant.userName = "participant";

        this.host = this.stack.createChild(VideoDisplay, {events: {
            aspect: this.updateLayout.bind(this),
            mute: (e) => this.dispatchEvent(new MuteEvent(e.track, "host")),
        }});
        this.host.userName = "host";


        let robs = new ResizeObserver(() => {
            this.updateLayout()
        })
        robs.observe(this.root);
        // this.startUpdating();
    }

    // async startUpdating(){
    //     while(!this.stop) {
    //         this.updateLayout();
    //         await delay();
    //     }
    // }

    async updateLayout(){
        // if (this.scheduled) return;
        // this.scheduled = true;
        // await delay();
        let size = this.bbox[1];
        if (!size.isZero) {
            let taspect = size.x / size.y;
            let paspect = this.participant.aspect;
            let haspect = this.host.aspect;

            this.host.shown = haspect !== 0;
            this.participant.shown = paspect !== 0;
            
            if (haspect + paspect > 0) {
                
                let stackaspects = [
                    (paspect + haspect),        // stacking horizontally
                    1/((paspect==0 ? 0 : 1/paspect) + (haspect==0 ? 0 : 1/haspect)),  // stacking vertically
                ]
                let stackareas = stackaspects.map(a => {
                    // wider than total aspect
                    if (a > taspect) {
                        return [a * size.y ** 2, true];

                    // higher than total aspect
                    } else {
                        return [(size.x ** 2) / a, false];
                    }
                });

                let isHorizontal = stackareas[0][0] < stackareas[1][0];
                let isFillToWidth = isHorizontal ? stackareas[0][1] : stackareas[1][1];
                let stackaspect = stackaspects[isHorizontal ? 0 : 1];

                let stackSize = new Vector(
                    (isFillToWidth ? size.x : size.y * stackaspect),
                    (isFillToWidth ? size.x / stackaspect : size.y)
                )
               

                this.stack.setAttribute("stack-mode", isHorizontal ? "horizontal" : "vertical");
                [this.host, this.participant].forEach(el => {
                    let aspect = el.aspect;
                    if (aspect > 0) {
                        el.size = new Vector(
                            !isHorizontal ? stackSize.x : stackSize.y * aspect,
                            !isHorizontal ? stackSize.x / aspect : stackSize.y
                        )
                    }
                })
            }
        }
        // this.scheduled = false;
    }

    static get usedStyleSheets(){
        return [relURL("./style.css", import.meta)]
    }
}