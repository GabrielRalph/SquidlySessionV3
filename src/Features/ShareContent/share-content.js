import { SvgPlus } from "../../SvgPlus/4.js";
import { Features } from "../features-interface.js";
import { ContentViewer } from "./content-view.js";
import { RTCSignaler } from "../../Utilities/WebRTC/rtc-signaler.js";
import { ConnectionManager } from "../../Utilities/WebRTC/webrtc-base.js";



function getDefaulIceServers(){
    return {iceServers: [
        {urls: "stun:stun.l.google.com:19302"},
        {urls: "stun:stun1.l.google.com:19302"},
        {urls: "stun:stun2.l.google.com:19302"},
        {urls: "stun:stun3.l.google.com:19302"},
        {urls: "stun:stun4.l.google.com:19302"},
        {urls: "stun:stun01.sipphone.com"},
        {urls: "stun:stun.ekiga.net"},
        {urls: "stun:stun.fwdnet.net"},
        {urls: "stun:stun.ideasip.com"},
        {urls: "stun:stun.iptel.org"},
        {urls: "stun:stun.rixtelecom.se"},
        {urls: "stun:stun.schlund.de"},
        {urls: "stun:stunserver.org"},
        {urls: "stun:stun.softjoys.com"},
        {urls: "stun:stun.voiparound.com"},
        {urls: "stun:stun.voipbuster.com"},
        {urls: "stun:stun.voipstunt.com"},
        {urls: "stun:stun.voxgratia.org"},
        {urls: "stun:stun.xten.com"},
        {urls: "stun:stun.xten.com"},
        {urls: "turn:13.239.38.47:80?transport=udp", 
        credential: "key1", username: "username1"},
        {urls: "turn:13.239.38.47:80?transport=tcp", 
        credential: "key1", username: "username1"},
        {urls: "stun:stun.xten.com"},
    ]}
}

export class ShareContent extends Features {
    _isSharing = false;
    constructor(session, sdata){
        super(session, sdata)
        this.contentView = new ContentViewer(this);
        this.contentView.root.events = {
            transform: (e) => this.sdata.set("content-transform", e.transform),
            page: () => this.sdata.set("content-info/page", this.contentView.page),
            close: (e) => e.waitFor(this.close()),
            upload: (e) => this.shareFile(),
            screen: (e) => this.shareScreen()
        }
        this.session.toolBar.addSelectionListener("file", this.shareFile.bind(this))
        this.session.toolBar.addSelectionListener("screen", this.shareScreen.bind(this))
    }


    async uploadFile(file) {
        this.contentView.loader.show(400);

        let type = file.type == "application/pdf" ? "pdf" : "image";

        // // upload file
        let url = await this.sdata.uploadFile(file, "content", (e) => {
            this.contentView.loader.progress = 0.7 * e.bytesTransferred / e.totalBytes
        });

        let contentInfo = {
            type: type,
            url: url,
            page: 0,
        }

        await this.sdata.set("content-info", contentInfo);
    }

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

    async  shareFile() {
        let input = new SvgPlus("input");
        input.props = {
            type: "file",
        }
        input.click();
        
        await new Promise((r) => {
            input.addEventListener("input", r)
        })

        if (input.files.length > 0) {
            this.session.openWindow("shareContent")
            this.uploadFile(input.files[0])
        }        
    }


    async stopSharing(){
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

        this._shareScreen = new ConnectionManager(false, {video: true});
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

    static get firebaseName(){
        return "share-content"
    }
}