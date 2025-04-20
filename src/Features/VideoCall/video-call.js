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

const DATA_DELIMITER = ":::"
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
     * Sends data across the webrtc data channel. A path must 
     * be specified in order to route data to the correct location.
     * 
     * @param {string} path 
     * @param {Object|string|number|boolean} data
     */
    async sendData(path, data) {
        if (typeof path === "string" && path.length > 0) {
            let dataString = null;
            switch (typeof data) {
                case "object": dataString = 'J' + JSON.stringify(a); break;
                case "number": dataString = 'N' + data; break;
                case "boolean": dataString = 'B' + (data ? 1 : 0); break;
                case "string": dataString = 'S' + data; break;
                default:
                    console.warn(`Cannot send ${typeof data} accross webrtc data channel.`);
                    break;
            }
            
            if (dataString !== null) {
                let fullString = path + ":::" + dataString;
                WebRTC.send(fullString);
            }
        }
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

    _setWidgetUserImage(url, user) {
        this._allWidgets.forEach(w => {
            w[user].userImage = url;
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
        let resData = null;
        let path = null;
        
        try {
            let match = data.match(DATA_DELIMITER);
            path = data.slice(0, match.index);
            let type = data[match.index + DATA_DELIMITER.length];
            let dataString = data.slice(match.index + DATA_DELIMITER.length + 1);
            
            switch (type) {
                case "J": resData = JSON.parse(dataString); break;
                case "N": resData = Number(dataString); break;
                case "B": resData = dataString === "1"; break;
                case "S": resData = dataString;
            }
        } catch (e) {
            console.warn("Error parsing data from webrtc channel", e)
        }

        if (path != null) {
            const event = new Event(path);
            event.data = resData;
            this.dispatchEvent(event);
        }
    }

    /**
     * @param {("audio"|"video")} type
     * @param {boolean} bool
     * @param {("host"|"participant")} user
     */
    async _updateMutedState(type, bool, user, setDB = true) {
        if (user in this.muteState && type in this.muteState[user]) {
            if (typeof bool !== "boolean" && user == this.sdata.me) {
                bool = this.presets[user + '-' + type];
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

            if (presets.image) {
                this._setWidgetUserImage(presets.image, "host");
            }
            
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