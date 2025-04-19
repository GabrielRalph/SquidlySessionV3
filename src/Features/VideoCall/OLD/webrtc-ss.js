
export class WebRTCSS {
    constructor() {
        this._buffer = [];
    }

    async initialise(config, toWatch = false){
        if (!this.initialised) {
            this.initialised = true;
            let pc = new RTCPeerConnection(config);
            this.config = config;
            this.pc = pc;
            this.makingOffer = false;
            this.remoteStream = null;
            pc.ontrack = (e) => this.ontrackadded(e)
            pc.onnegotiationneeded = (e) => this.onnegotiationneeded(e);
            pc.oniceconnectionstatechange = (e) => this.oniceconnectionstatechange(e);
            pc.onicecandidate = (e) => this.onicecandidate(e);
    
            let stream = null;
            if (!toWatch) {
                if (this.stream instanceof MediaStream) {
                    stream = this.stream;
                } else {
                    // create dummy stream
                    let [width, height] = [640, 480];
                    let canvas = Object.assign(document.createElement("canvas"), {width, height});
                    canvas.getContext('2d').fillRect(0, 0, width, height);
                    stream = canvas.captureStream();
                }
            }
    
            // console.log(stream)
            if (stream !== null) {
                for (const track of stream.getTracks()) {
                    pc.addTrack(track, stream);
                }
            }
    
            this.stream = stream;
    
            // console.log("buffer", this._buffer);
            while (this._buffer.length != 0) {
                this.onSignal(this._buffer.shift());
            }
        } else {
            this.pc.restartIce();
        }
    }

    send(object) {}
    onStream(stream) {}

    async onSignal({ description, candidate }) {
        // console.log("signal");
        if (this.pc instanceof RTCPeerConnection) {
            let {stream, pc, makingOffer} = this;
            try {
                if (description) {
                    console.log("description " + description.type);
                    // console.log(pc.signalingState, makingOffer);
                    const offerCollision =
                        description.type === "offer" &&
                        (makingOffer || pc.signalingState !== "stable");
    
                    let ignoreOffer = (stream !== null) && offerCollision;
                    // console.log("ignore", ignoreOffer);
                    if (!ignoreOffer) {
                        try {
                            console.log("setting remote description");
                            await pc.setRemoteDescription(description);
                            if (description.type === "offer") {
                                console.log("here");
                                await pc.setLocalDescription();
                                console.log("sending description");
                                this.send({ description: pc.localDescription.toJSON() });
                            }
                        } catch (e) {
                            throw `description failure`
                        }
                    }
                } else if (candidate) {
                    // console.log("candidate in", candidate);
    
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (e) {
                        if (!ignoreOffer) {
                            console.log(e);
                            throw 'candidate failure';
                        }
                    }
                }
            } catch (e) {
            }
        } else {
            // console.log("buffer", this._buffer);
            this._buffer.push({candidate, description});
        }
    }
      
    onicecandidate(data) {
        // console.log("candidate out", data);
        if (data.candidate) {
            this.send({candidate: data.candidate.toJSON()});
        }
    }
      
    oniceconnectionstatechange(){
        let {pc} = this;
        console.log("ss-state", this.state)
        
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        } if (pc.iceConnectionState == "disconnected") {
        }
    }
      
    async onnegotiationneeded(){
        let {pc} = this;
        try {
            this.makingOffer = true;
            await pc.setLocalDescription();
            this.send({ description: pc.localDescription.toJSON() });
        } catch (err) {
            console.error(err);
        } finally {
            this.makingOffer = false;
        }
    }
      
    ontrackadded({ track, streams }){
        this.remoteStream = streams[0];
        track.onunmute = () => {
            let {pc} = this;
            this.onStream(streams[0]);
            this._track_live = true;
            console.log("ss-state", this.state)
        };
        track.onmute = () => {
            this._track_live = false;
            console.log("ss-state", this.state)

        }
    }


    
    get connected(){
        return this.pc.iceConnectionState == "connected";
    }

    get state(){
        return `${this.connected ? "i": "-"}${this._track_live ? "t" : "-"}`
    }

    stopTrack(){
        let {stream} = this;
        if (stream instanceof MediaStream)  {
            stream.oninactive = null;
            for (let track of stream.getTracks()) {
                track.stop();
            }
        }
    }

    async replaceStream(displayMediaOptions = {
        video: {
            displaySurface: "window",
            
        },
        audio: false,
        surfaceSwitching: "include",
        selfBrowserSurface: "exclude",
    }){
        let stream = null;
        let result = false;
        let oldStream = this.stream;
        try {
            if (oldStream instanceof MediaStream)  {
                oldStream.oninactive = null;
            }

            stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

            let videoTrack = stream.getVideoTracks()[0];
            videoTrack.onmute = () => {
                console.log("Track muted ", videoTrack.muted);
            }
            
            this.stream = stream;
            result = true;
        } catch (err) {
            stream = oldStream;
            console.error(`Error: ${err}`);
        }
        
        
        stream.oninactive = () => {
            console.log("TRACK INACTIVATE");
            this.onStream(null)
        }
            
        this.onStream(stream);
            
        if (result) {
            if (this.pc instanceof RTCPeerConnection) {
                const [videoTrack] = stream.getVideoTracks();
                const sender = this.pc.getSenders().find((s) => s.track.kind === videoTrack.kind);
                // console.log("Found sender:", sender);
                sender.replaceTrack(videoTrack);
            }

            // stop old Stream tracks
            if (oldStream instanceof MediaStream) {
                for (let track of oldStream.getTracks()) {
                    track.stop();
                }
            }
        }

        return true;
        
    }
}
