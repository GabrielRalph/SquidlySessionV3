import { SvgPlus } from "../../SvgPlus/4.js";
import { Features } from "../features-interface.js";
import { ContentViewer } from "./content-view.js";
import { RTCSignaler } from "../../Utilities/WebRTC/rtc-signaler.js";
import { ConnectionManager } from "../../Utilities/WebRTC/webrtc-base.js";


export default class ShareContent extends Features {
    _isSharing = false;
    constructor(session, sdata){
        super(session, sdata)
        this.contentView = new ContentViewer(this);
        this.contentView.root.events = {
            transform: (e) => this.sdata.set("content-transform", e.transform),
            page: () => this.sdata.set("content-info/page", this.contentView.page),
            close: (e) => e.waitFor(this.close()),
            upload: (e) => {
                this.shareFile()
            },
            screen: (e) => this.shareScreen()
        }
        this.session.toolBar.addMenuItems("share", [
            {
                name: "screen",
                index: 0,
                onSelect: e => e.waitFor(this.shareScreen())
            },
            {
                name: "file",
                index: 90,
                onSelect: e => {
                    if (e.clickMode === "click")
                        e.waitFor(this.shareFile())
                }
            }
        ]);
    }


    /**
     * Uploads a file to storage and sets the content info in the database
     * @param {File} file The file to upload
     * @return {Promise<void>}
     */
    async uploadFile(file) {
        // Bring up the file loader 
        this.contentView.loader.show(400);

        let type = file.type == "application/pdf" ? "pdf" : "image";

        // upload file to storage and update progress bar
        let url = await this.sdata.uploadFile(file, "content", (e) => {
            this.contentView.loader.progress = 0.7 * e.bytesTransferred / e.totalBytes
        });

        // Set content info to database
        await this.sdata.set("content-info", {
            type: type,
            url: url,
            page: 0,
        });
    }


    /**
     * Prompts the user to share their screen and sets up the stream for sharing
     * @return {Promise<void>}
     */
    async shareScreen(){
        let stream = null;
        let oldStream = this._shareScreen.stream;

        // share screen media options
        let displayMediaOptions = {
            video: {
                displaySurface: "window",
                
            },
            audio: false,
            surfaceSwitching: "include",
            selfBrowserSurface: "exclude",
        }

        try {
            // promt user to select a screen/window to share
            stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

            // add stream events
            stream.oninactive = () => {
                this.contentView.setStream(null, this.sdata.me);
                this.sdata.set("content-info", null);
                this.session.openWindow("default");
            }

            // clear old stream events
            if (oldStream instanceof MediaStream) oldStream.oninactive = null;
         
            // set the stream to the connection manager and content view
            this.contentView.stream = stream;
            this._shareScreen.replaceStream(stream);
            this.contentView.setStream(stream, this.sdata.me);
            this._isSharing = true;

            this.sdata.set("content-info", {
                type: "stream",
                url: Math.random(),
                page: this.sdata.me,
            });

            this.session.openWindow("shareContent");
        } catch (err) {
            
        }
    }

    /**
     * Prompts the user to select a file and uploads it for sharing
     * @return {Promise<void>}
     */
    async shareFile() {
        let input = new SvgPlus("input");
        input.props = {
            type: "file",
            accept: "image/*,application/pdf",
        }

        await new Promise((r) => {
            input.addEventListener("input", r)
            let res = input.click();
            console.log(res);
        })

        if (input.files.length > 0) {
            this.uploadFile(input.files[0])
            await this.session.openWindow("shareContent")
        }        
    }

    /**
     * Stops sharing the current screen
     */
    stopSharing(){
        if (this._isSharing) {
            let stream = this._shareScreen.stream;
            stream.oninactive = null;
            if (stream instanceof MediaStream) {
                stream.getTracks().forEach((track) => {
                    track.stop();
                })
            }
            this._isSharing = false;
        }
    }


    async close(){
        this.stopSharing()
        await this.session.openWindow("default");
    }

    async initialise(){
        let signaler = new RTCSignaler(this.sdata.child("rtc"));

        // create dummy stream
        let [width, height] = [640, 480];
        
        let canvas = Object.assign(new SvgPlus("canvas"), {width, height});
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let stream = canvas.captureStream();
        ctx.fillRect(0, 0, width, height);

        this._shareScreen = new ConnectionManager(false, {video: true}, (connection) => {
            return !connection.isICEConnected;
        });
        
        this._shareScreen.on("state", (data) => {
            if (data.remoteStream && data.video != null) {
                this.contentView.setStream(data.remoteStream, this.sdata.them);
            }
        })
        this._shareScreen.start(this.sdata.iceServers, stream, signaler);

        let contentInfo = await this.sdata.get("content-info");
        if (contentInfo !== null && contentInfo.type === "stream" && contentInfo.page === this.sdata.me) {
            await this.session.openWindow("default");
        }

        this.sdata.onValue("content-info", (contentInfo) => {
            if (contentInfo !== null && contentInfo.type === "stream" && contentInfo.page !== this.sdata.me) {
                this.stopSharing();
            }
            this.contentView.updateContentInfo(contentInfo);
        })

        this.sdata.onValue("content-transform", (t) => {
            if (t !== null) {
                this.contentView.content.contentTransform = t;
            }
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    static get layers() {
        return {
            contentView: {
                type: "area",
                area: "fullAspectArea",
                index: 60,
            }
        }
    }


    static get name(){
        return "shareContent"
    }

    static get firebaseName(){
        return "share-content"
    }
}