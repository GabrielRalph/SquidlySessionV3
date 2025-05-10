import { RTCSignaler } from "./rtc-signaler.js";
const GetTrackMethods = {
    "video": "getVideoTracks",
    "audio": "getAudioTracks"
}
const MinTimeTillRestart = 5000; // 5 seconds

/* Log Functions
    */
window.show_rtc_base = false;
function rtc_base_log(str) {
    if (window.show_rtc_base) {
      console.log("%c\t" + str, 'color: #bada55; background:rgb(27, 30, 33); padding: 10px; border-radius: 10px;');
    }
}

function rtc_l1_log(str) {
  console.log("%c" + str, 'color:#00a3fd; background:rgb(27, 30, 33); padding: 10px; border-radius: 10px;');
}

function preferOpus(description) {
    // const sdp = description.sdp;
    // const sdpLines = sdp.split('\r\n');
    // const mLineIndex = sdpLines.findIndex(line => line.startsWith('m=audio'));

    // if (mLineIndex === -1) return sdp;

    // const opusPayload = sdpLines.find(line => line.includes('opus/48000'))?.match(/:(\d+) opus\/48000/);
    // if (!opusPayload) return sdp;

    // const payload = opusPayload[1];
    // const mLine = sdpLines[mLineIndex].split(' ');
    // const newMLine = [mLine[0], mLine[1], mLine[2], payload, ...mLine.slice(3).filter(p => p !== payload)];
    // sdpLines[mLineIndex] = newMLine.join(' ');

    // const sdpMod = sdpLines.join('\r\n');

    // return new RTCSessionDescription({
    //     type: description.type,
    //     sdp: sdpMod
    // })
    return description;
}

let GlobalCount = 0;
class WebRTCConnection {

    /** @type {MediaStream} */
    RemoteStream = null;
    
    /** @type {MediaStream} */
    LocalStream = null;
    
    /** @type {RTCPeerConnection} */
    PC = null;
    
    /** @type {RTCSignaler} */
    Signaler = null;
    
    RemoteContentStatus = {
        video: null,
        audio: null,
        data_send: null,
        data_receive: null,
        ice_state: null,
        sent: null,
        recv: null,
    }
    
    /** @type {RTCDataChannel?} */
    ReceiveChannel = null;

    /** @type {RTCDataChannel?} */
    SendChannel = null;

    
    makingOffer = false;
    ignoreOffer = false;
    sessionState = "closed";
    
    EventListeners = {};
    LastConfig = null;

    monitorTracks = {video: true, audio: true}

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ CHANNEL RECEIVERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
      
    receiverModes = {
        "S": () => {
      
        },
        "J": (d) => {
            try {
                this.callEvent("data", JSON.parse(d))
            } catch (e) {}
        },
        "N": (d) => {
            this.callEvent("data", d);
        },
        "A": () => {
            this.sessionState = "open"
            this.RemoteContentStatus.recv = true;
            this.updateHandler();
        }
    }

    constructor(config, stream, signaler, useDataChannel = true) {
        this.id = GlobalCount;
        this.config = config;
        this.LocalStream = stream;
        this.Signaler = signaler;
        this.useDataChannel = useDataChannel;
        GlobalCount++;
    }


    async start() {
        this.timeOfStart = new Date().getTime();
        await this.Signaler.restart();

        this.PC = new RTCPeerConnection(this.config);
        const {PC, Signaler, LocalStream} = this;

        PC.ondatachannel = this.ondatachannel.bind(this);
        PC.ontrack = this.ontrackadded.bind(this)
        PC.onnegotiationneeded = this.onnegotiationneeded.bind(this);
        PC.oniceconnectionstatechange = this.oniceconnectionstatechange.bind(this);
        PC.onicecandidate = this.onicecandidate.bind(this);

        Signaler.on("candidate", this.onCandidate.bind(this));
        Signaler.on("description", this.onDescription.bind(this));

       
        if (this.useDataChannel) this.startMessageChannel();
        for (const track of LocalStream.getTracks()) {
            PC.addTrack(track, LocalStream);
        }
    
        await Signaler.start();    
        this.updateHandler();
    }

    get isRemoteStreamReady(){
        const {video, audio, data_send, data_receive, ice_state} = this.RemoteContentStatus;
        return this.RemoteStream instanceof MediaStream && 
            ("video" in this.monitorTracks ? video : true) &&
            ("audio" in this.monitorTracks ? audio : true) &&
            ice_state == "connected";
    }
    
    get isStatusReady(){
        const {video, audio, data_send, data_receive, ice_state} = this.RemoteContentStatus;
        return video && audio && data_send == "open" && data_receive == "open" && ice_state == "connected";
    }

    get isDataChannelReady(){
        const {recv, sent, data_send, data_receive} = this.RemoteContentStatus;
        return recv && sent && data_send == "open" && data_receive == "open";
    }


    logState(){
        let {RemoteContentStatus: {video, audio, data_send, data_receive, ice_state, sent, recv}} = this;
        let cc = (val) => `color: ${val ? "#bada55" : "#eb5533"}; background:rgb(27, 30, 33); padding: 3px; ]`
        data_send = data_send == "open";
        data_receive = data_receive == "open";
        ice_state = ice_state == "connected";
        console.log(`${this.id}: %cvid %caud %cin %cout %cice %csent %crecv`, cc(video), cc(audio), cc(data_receive), cc(data_send), cc(ice_state), cc(sent), cc(recv));
    }
      
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ UPDATE HANDLER ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    callEvent(key, data) {
        if (key in this.EventListeners) {
            for (let cb of this.EventListeners[key]) cb(data);
        }
    }
    

    updateHandler(){
        const {sessionState, RemoteContentStatus, isStatusReady, RemoteStream} = this;
        if (this.useDataChannel) {
            // Session is open and has now started
            // Send message to remote caller telling them we are open
            if (!RemoteContentStatus.sent && isStatusReady) {
                this.sendMessage("A");
                RemoteContentStatus.sent = true;
        
            // Session has closed
            } else if (sessionState == "open" && !isStatusReady) {
                this.sessionState = "closed";
                rtc_l1_log("closed");
            }
        } else {
            this.sessionState = this.isRemoteStreamReady ? "open" : "closed";
        }
    
        this.logState();
        let copy = {};
        for (let key in RemoteContentStatus) copy[key] = RemoteContentStatus[key];
        copy.state = sessionState;
        copy.remoteStream = RemoteStream;
        copy.isRemoteStreamReady = this.isRemoteStreamReady;
        this.callEvent("state", copy);
    }
    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ WEBRTC BASE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    
    ontrackadded({ track, streams }){
        streams[0].oninactive = () => {
            rtc_base_log("STream inactive")
        }
        rtc_base_log(`track received ${track.kind} [${streams[0].id.split("-")[0]}]`);
        this.RemoteStream = streams[0];
    
        track.onunmute = () => {
            rtc_base_log("track unmuted " + track.kind);
            this.RemoteContentStatus[track.kind] = track;
            this.updateHandler();
        };
        
        track.onmute = () => {
            rtc_base_log("track muted " + track.kind);
            this.RemoteContentStatus[track.kind] = null;
            this.updateHandler();
        }
    }
    
    async onnegotiationneeded(){
      rtc_base_log("negotiation needed " );
      try {
        this.makingOffer = true;
    
        await this.PC.setLocalDescription();
        rtc_base_log("description --> " + this.PC.localDescription.type);
        this.Signaler.send(preferOpus(this.PC.localDescription));
      } catch (err) {
        console.error(err);
      } finally {
        this.makingOffer = false;
      }
    }
    
    oniceconnectionstatechange(){
        const {PC, RemoteContentStatus} = this;
        if (PC.iceConnectionState === "failed") {
          PC.restartIce();
        } else if (PC.iceConnectionState == "connected"){
        } else if (PC.iceConnectionState === "disconnected") {
            this.closeSendMessageChannel();
        }
        RemoteContentStatus.ice_state = PC.iceConnectionState;
        this.updateHandler();
    }
    
    onicecandidate(data) {
        rtc_base_log("candidate -->");
        this.Signaler.send(data.candidate);
    }
    
    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ DATA CHANNEL METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    ondatachannel(event) {
        if (this.SendChannel == null) {
            this.startMessageChannel();
        }
        this.ReceiveChannel = event.channel;
        this.ReceiveChannel.onmessage = this.handleReceiveMessage.bind(this);
        this.ReceiveChannel.onopen = this.handleReceiveChannelStatusChange.bind(this);
        this.ReceiveChannel.onclose = this.handleReceiveChannelStatusChange.bind(this);
    }
    
    startMessageChannel(){
        if (this.SendChannel) {
            this.SendChannel.close();
        }
        this.SendChannel = this.PC.createDataChannel("sendChannel");
        this.SendChannel.onopen = this.handleSendChannelStatusChange.bind(this);
        this.SendChannel.onclose = this.handleSendChannelStatusChange.bind(this);
    }

    closeSendMessageChannel(){
        if (this.SendChannel) {
            this.SendChannel.close();
        }
        this.RemoteContentStatus.recv = false;
        this.RemoteContentStatus.send = false;
        this.SendChannel = null;
    }

    closeReceiveMessageChannel(){
        if (this.ReceiveChannel) {
            this.ReceiveChannel.close();
        }
        this.RemoteContentStatus.recv = false;
        this.RemoteContentStatus.send = false;
        this.ReceiveChannel = null;
    }
    
    /* Send message sends a message accros the data channel*/
    sendMessage(message) {
        const {SendChannel} = this;
        if (SendChannel && SendChannel.readyState == "open") {
            SendChannel.send(message);
        }
    }
    
    /* Send message sends a message accros the data channel*/
    handleReceiveMessage(event) {
        const {data} = event;
        const mode = data[0];
        if (mode in this.receiverModes) {
            this.receiverModes[mode](data.slice(1))
        }
    }
    
    handleReceiveChannelStatusChange(event) {
        const {RemoteContentStatus, ReceiveChannel} = this;
        if (ReceiveChannel) {
            const state = ReceiveChannel.readyState;
            RemoteContentStatus.data_receive = state;
            if (state == "closed") {
                this.closeReceiveMessageChannel();
            }
            this.updateHandler("state");
        }
    }
      
    handleSendChannelStatusChange(event) {
        const {SendChannel, RemoteContentStatus} = this;
        if (SendChannel) {
            const state = SendChannel.readyState;
            RemoteContentStatus.data_send = state
            if (state == "closed") {
                this.closeSendMessageChannel();
            }
            this.updateHandler("state")
        }
    }
    
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ SIGNALER CALLBACKS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    
    
    async onDescription(description) {
        const {PC, Signaler, makingOffer} = this;
        rtc_base_log("description <-- " + description.type);
        rtc_base_log(PC.signalingState);
    
    
        const offerCollision = description.type === "offer" &&
                              (makingOffer || PC.signalingState !== "stable");
    
        this.ignoreOffer = !Signaler.isPolite && offerCollision;
        if (!this.ignoreOffer) {
            try {
              await PC.setRemoteDescription(description);
              if (description.type === "offer") {
                await PC.setLocalDescription();
                rtc_base_log("description --> " + PC.localDescription.type);
                Signaler.send(preferOpus(PC.localDescription))
              }
            } catch (e) {
            }
        }
    }
    
    async onCandidate(candidate) {
        rtc_base_log("candidate <--");
    
        try {
            await this.PC.addIceCandidate(candidate);
            rtc_base_log("candidate <--");
        } catch (e) {
            if (!this.ignoreOffer) {
            }
        }
    }
    
    close(){
        this.EventListeners = {};
        this.PC.close();
        this.closeSendMessageChannel();
        this.closeReceiveMessageChannel();
        this.Signaler.removeAllListeners();
    }

    on(key, cb) {
        if (cb instanceof Function) {
            if (!(key in this.EventListeners)) {
                this.EventListeners[key] = [];
            }
            this.EventListeners[key].push(cb);
        }
    }
}

export class ConnectionManager {
    EventListeners = {};
    restartTimeout = null;
    stream = null;
    signaler = null;
    config = null;

    constructor(useDataChannel = true, monitorTracks = {video: true, audio: true}) {
        this.useDataChannel = useDataChannel;
        this.monitorTracks = monitorTracks;
    }

    closeConnection(){
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
    }

    async start(config = this.config, stream = this.stream, signaler = this.signaler) {
        this.closeConnection();
        this.config = config;
        this.stream = stream;

        let func = (e) => {
            console.log("track changed");
            if (e.srcElement === this.stream) {
                const {newTrack, oldTrack} = e;
                this.replaceTrack(oldTrack, newTrack);
            } else {
                console.log("removing event listener");
                
                e.srcElement.removeEventListener("trackchanged", func);
            }
        }
        // this.stream.addEventListener("trackchanged", func);
        this.stream.ontrackchanged = func;
        console.log(this.stream);
        
    
        this.signaler = signaler;
    
        this.connection = new WebRTCConnection(config, stream, signaler, this.useDataChannel);
        this.connection.monitorTracks = this.monitorTracks;
        this.connection.id = signaler.fb.getFirebaseName() + "-" + this.connection.id
        this.connection.EventListeners = this.EventListeners;
        await this.connection.start();
        signaler.on("restart", () => {
            clearTimeout(this.restartTimeout);
            let dtime = new Date().getTime() - this.connection.timeOfStart;
            let restart = () => {
                rtc_l1_log("restarting")
                this.start();
            }
            if (dtime < MinTimeTillRestart) {
                this.restartTimeout = setTimeout(() => {
                    if (this.connection.sessionState !== "open") {
                        restart();
                    }
                }, dtime);
            } else {
                restart();
            }
        });
    }

    on(key, cb) {
        if (cb instanceof Function) {
            if (!(key in this.EventListeners)) {
                this.EventListeners[key] = [];
            }
            this.EventListeners[key].push(cb);
        }
    }

    send(data) {
        if (this.connection !== null && this.connection.isDataChannelReady) {
            if (typeof data === "object" && data !== null) {
                data = JSON.stringify(data);
                this.connection.sendMessage("J"+data);
            } else {
                this.connection.sendMessage("N"+data);
            }
        }
    }

    /** Mutes a local track, either video or audio.
     * @param {("audio"|"video")} type
     * @param {boolean?} bool whether the track is enabled 
     *                        if set null toggles the track state
     * @return {boolean?} returns the enable state of the track 
     *                    null if no track was set.
     */
    muteTrack(type, bool) {
        if (type in GetTrackMethods) {
            let tracks = this.stream[GetTrackMethods[type]]();
            let t = tracks[0];
            if (bool == null) bool = !t.enabled;
            t.enabled = bool;
        } else {
            bool = null;
        }
        return bool;
    }

    /** @param {MediaStream} stream */
    replaceStream(stream){
        let oldStream = this.stream;
        if (this.connection && this.connection.PC instanceof RTCPeerConnection) {
            for (let track of stream.getTracks()) {
                const sender = this.connection.PC.getSenders().find((s) => s.track.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                }
            }
        }
        for (let track of oldStream.getTracks()) {
            track.stop();
        }
        this.stream = stream;
    }

    /** @param {MediaStreamTrack} track */
    replaceTrack(oldTrack, newTrack){
        console.log(`replacing track\n OLD: ${oldTrack.label}\n NEW: ${newTrack.label}`);
        
        if (this.connection && this.connection.PC instanceof RTCPeerConnection) {
            const sender = this.connection.PC.getSenders().find((s) => s.track === oldTrack);
            if (sender) {
                sender.replaceTrack(newTrack);
            }
        }
    }
    
}
    
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ INITIALISE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
// /** @type {WebRTCConnection} */
// let CurrentConnection = null;
// let LastConfig = null;
// let LastStream = null;
// let LastSignaler = null;
// let RestartTimeout = null;
// let GlobalEventListeners = {}

// export async function initialise(config = LastConfig, stream = LastStream, signaler = LastSignaler) {
//     LastConfig = config;
//     LastStream = stream;
//     LastSignaler = signaler;

//     CurrentConnection = new WebRTCConnection(config, stream, signaler);
//     CurrentConnection.EventListeners = GlobalEventListeners;
//     await CurrentConnection.start();
//     signaler.on("restart", () => {
//         clearTimeout(RestartTimeout);
//         let dtime = new Date().getTime() - CurrentConnection.timeOfStart;
//         let restart = () => {
//             rtc_l1_log("restarting")
//             CurrentConnection.close();
//             initialise();
//         }
//         if (dtime < MinTimeTillRestart) {
//             setTimeout(() => {
//                 if (CurrentConnection.sessionState !== "open") {
//                     restart();
//                 }
//             }, dtime);
//         } else {
//             restart();
//         }
//     });
// }

// export function on(key, cb) {
//     if (CurrentConnection) {
//         CurrentConnection.on(key, cb);
//         GlobalEventListeners = CurrentConnection.EventListeners;
//     } else {
//         if (cb instanceof Function) {
//             if (!(key in GlobalEventListeners)) {
//                 GlobalEventListeners[key] = [];
//             }
//             GlobalEventListeners[key].push(cb);
//         }
//     }
// }

// export function send(data) {

//     if (CurrentConnection !== null && CurrentConnection.isDataChannelReady) {
//         if (typeof data === "object" && data !== null) {
//             data = JSON.stringify(data);
//             CurrentConnection.sendMessage("J"+data);
//         } else {
//             CurrentConnection.sendMessage("N"+data);
//         }
//     }
// }



