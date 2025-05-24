import { getStream, startWebcam } from "../../Utilities/webcam.js";
import { Features } from "../features-interface.js";
import { setupVoiceDetection } from "./AudioUtils/voice-detector.js";
import { getHostPresets } from "./presets.js";
import { RTCSignaler } from "../../Utilities/WebRTC/rtc-signaler.js";
import * as WebRTC from "../../Utilities/WebRTC/webrtc-base.js"
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
            video: undefined,
            audio: undefined
        },
        participant: {
            video: undefined,
            audio: undefined,
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
                case "object": dataString = 'J' + JSON.stringify(data); break;
                case "number": dataString = 'N' + data; break;
                case "boolean": dataString = 'B' + (data ? 1 : 0); break;
                case "string": dataString = 'S' + data; break;
                default:
                    console.warn(`Cannot send ${typeof data} accross webrtc data channel.`);
                    break;
            }
            
            if (dataString !== null) {
                let fullString = path + ":::" + dataString;
                this._mainConnection.send(fullString);
            }
        }
    }


    /**
     * @param {("audio"|"video")} type
     * @param {("host"|"participant")} user
     */
    async toggleMuted(type, user) {
        if (user in this.muteState && type in this.muteState[user]) {
            let oldState = this.muteState[user][type];
            await this._updateMutedState(type, !oldState, user);
        }
        console.log(`Toggled ${user}'s ${type} mute state`);
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

    _setWidgetTalking(bool, user) {
        this._allWidgets.forEach(w => {
            w[user].isTalking = bool;
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
        // console.log(state.isRemoteStreamReady);
        
        if (!state.isRemoteStreamReady) {
            stream = null;
        }
        // console.log("stream:", stream);
        
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
            if (typeof bool !== "boolean") {
                bool = true
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
                this._mainConnection.muteTrack(type, bool)
            }
            this._setWidgetMuteState(type, !bool, user);
        }
    }


    async _setupMuteStateListeners(presets){
        const {sdata} = this;
        const {me, them} = sdata;

        let [videoMuted, audioMuted] = await Promise.all([
            sdata.get(`${me}/video`),
            sdata.get(`${me}/audio`)
        ]);

        // console.log(videoMuted, audioMuted);
        
        await Promise.all([
            videoMuted == null ? this._updateMutedState("video", !!presets[me+"-video"], me) : null,
            audioMuted == null ? this._updateMutedState("audio", !!presets[me+"-audio"], me) : null,
        ]);
      
        // listen to changes in the database mute state
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
        let connection = new WebRTC.ConnectionManager();
        connection.on("state", this._onWebRTCState.bind(this));
        connection.on("data", this._onWebRTCData.bind(this));
        if (await startWebcam()) {
            // Get presets from the host
            let presets = await getHostPresets(this.sdata.hostUID);
            this.presets = presets;
            
            // set the host's name
            let name = (presets.name || "host") + (presets.pronouns ? ` (${presets.pronouns})` : "")
            this._setWidgetUserName(name, "host");

            // set the host's image
            if (presets.image) {
                this._setWidgetUserImage(presets.image, "host");
            }
            
            // get new stream from webcam
            let stream = getStream(2);

            // set up voice detection
            setupVoiceDetection(stream, (d) => {
                this._setWidgetTalking(d, this.sdata.me)
            })
            
            // set up the connection
            let signaler = new RTCSignaler(this.sdata);
            let config = getDefaulIceServers(); // get configuration ice servers from firebase
            connection.start(config, stream, signaler);
            this._mainConnection = connection;

            this._setWidgetStream(stream, this.sdata.me)
            this._setupMuteStateListeners(presets);
            
            // add toolbar listeners
            this.session.toolBar.addSelectionListener("audio", () => {
                this.toggleMuted("audio", this.sdata.me)
            })
            this.session.toolBar.addSelectionListener("video", () => {
                this.toggleMuted("video", this.sdata.me)
            })

            this.session.settings.addEventListener("change", (e) => {
                let {user, group, setting, value} = e;
                if (user == this.sdata.me) {
                    if (group == "volume" && setting == "level") {
                        this.volume = value;
                    }
                }
            });

            this.volume = this.session.settings.get(`${this.sdata.me}/volume/level`);
        }

    }

    /** @param {number} value */
    set volume(value) {
        value = value / 100; // convert to 0-1 range
        this.topPanelWidget.volume = value;
        this.sidePanelWidget.volume = value;
        this.mainAreaWidget.volume = value;
    }

    get _allWidgets(){
        return [this.topPanelWidget, this.sidePanelWidget, this.mainAreaWidget]
    }

    static get firebaseName(){
        return "video-call"
    }
}