import { getStream, startWebcam } from "../../Utilities/webcam.js";
import { Features } from "../features-interface.js";
import { getHostPresets } from "./presets.js";
import { RTCSignaler } from "./WebRTC/rtc-signaler.js";
import * as WebRTC from "./WebRTC/webrtc-base.js"
import { VideoPanelWidget } from "./widgets.js";



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


    
export class VideoCall extends Features {
    muteState = {
        host: {
            video: true,
            audio: true
        },
        participant: {
            video: true,
            audio: true,
        }
    }
    
    constructor(session, sdata){
        super(session, sdata);
        this.topPanelWidget = new VideoPanelWidget();
        this.sidePanelWidget = new VideoPanelWidget();
        this.mainAreaWidget = new VideoPanelWidget();
        this._setWidgetEvents();
     
    }


    /**
     * @param {("audio"|"video")} type
     * @param {("host"|"participant")} user
     */
    async toggleMuted(type, user) {
        console.log(`toggling ${user}'s ${type}`);
        if (user in this.muteState && type in this.muteState[user]) {
            let oldState = this.muteState[user][type];
            await this._updateMutedState(type, !oldState, user);
        }
    }

    _setWidgetUserName(name, user) {
        this._allWidgets.forEach(w => {
            w[user].userName = name;
        })
    }

    _setWidgetEvents() {
        this._allWidgets.forEach(w => {
            w.addEventListener("mute", (e) => {
                this.toggleMuted(e.track, e.user);
            })
        })
    }

    _setWidgetStream(stream, user) {
        this._allWidgets.forEach(w => {
            w[user].srcObject = stream;
            w[user].muted = user == this.sdata.me
        })
    }

    _setWidgetMuteState(type, bool, user) {
        this._allWidgets.forEach(w => {
            w[user][type+"_muted"] = bool;
        })
    }

    _onWebRTCState(state) {
        let stream = state.remoteStream;
        console.log(state.isRemoteStreamReady);
        
        if (!state.isRemoteStreamReady) {
            stream = null;
        }
        console.log("stream:", stream);
        
        this._setWidgetStream(stream, this.sdata.them)
    }

    _onWebRTCData(data) {

    }

    /**
     * @param {("audio"|"video")} type
     * @param {boolean} bool
     * @param {("host"|"participant")} user
     */
    async _updateMutedState(type, bool, user, setDB = true) {
        if (user in this.muteState && type in this.muteState[user]) {
            if (typeof bool !== "boolean" && user == this.me) {
                bool = !this.presets[user + '-' + type];
                setDB = true;
            }

            if (this.muteState[user][type] != bool) {
                if (setDB) await this.sdata.set(`${user}/${type}`, bool);
            }
            this.muteState[user][type] = bool;

            const icons = {
                video: ["novideo", "video"],
                audio: ["mute", "unmute"]
            }

            if (user === this.sdata.me) {
                let iconName = bool ? icons[type][1] : icons[type][0];
                this.session.toolBar.setIcon(`control/${type}/name`, iconName);
                WebRTC.muteTrack(type, bool)
            }
            this._setWidgetMuteState(type, !bool, user);
        }
    }


    _setUpListeners(){
        const {sdata} = this;
        const {me, them} = sdata;
        sdata.onValue(`${me}/audio`, (value) => {
            this._updateMutedState('audio', value, me, false);
        })
        sdata.onValue(`${me}/video`, (value) => {
            this._updateMutedState('video', value, me, false)
        })
        sdata.onValue(`${them}/audio`, (value) => {
            this._updateMutedState('audio', value, them, false)
        })
        sdata.onValue(`${them}/video`, (value) => {
            this._updateMutedState('video', value, them, false)
        })
    }


    async initialise(){
        await VideoPanelWidget.loadStyleSheets();
        WebRTC.on("state", this._onWebRTCState.bind(this));
        WebRTC.on("data", this._onWebRTCData.bind(this));
        if (await startWebcam()) {
            let presets = await getHostPresets(this.sdata.hostUID);
            this.presets = presets;
            
            let name = (presets.name || "host") + (presets.pronouns ? ` (${presets.pronouns})` : "")
            this._setWidgetUserName(name, "host");
            
            let stream = getStream(2);// get new stream from webcam
    
            let signaler = new RTCSignaler(this.sdata);
    
            let config = getDefaulIceServers(); // get configuration ice servers from firebase
    
            WebRTC.initialise(config, stream, signaler);
            
            this._setWidgetStream(stream, this.sdata.me)

            this._setUpListeners();
            
            this.session.toolBar.addSelectionListener("audio", () => {
                this.toggleMuted("audio", this.sdata.me)
            })

            this.session.toolBar.addSelectionListener("video", () => {
                this.toggleMuted("video", this.sdata.me)
            })
        }
    }

    get _allWidgets(){
        return [this.topPanelWidget, this.sidePanelWidget, this.mainAreaWidget]
    }


    static get firebaseName(){
        return "video-call"
    }
}