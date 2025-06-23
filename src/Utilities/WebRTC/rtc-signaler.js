const RESTART_TIME = 2500;
export class RTCSignaler {
    /** @type {import("../../Features/features-interface").SessionDataFrame} */
    fb = null;
    _listening = false;
    _eventListeners = {}

    constructor(sdata) {
        this.fb = sdata;
    }

    async send(value) {
        let key = "";
        if (value instanceof RTCSessionDescription) {
            key = "descriptions";
            value = value.toJSON();
        } else if (value instanceof RTCIceCandidate) {
            key = "candidates";
            value = value.toJSON();
        } else {
            return;
        }

        const {fb} = this;
        await fb.pushSet(`${fb.me}/${key}`, value);
    }

    get isPolite(){
        return !this.fb.isHost;
    }

    on(key, cb) {
        
        if (cb instanceof Function) {
            if (!(key in this._eventListeners)) {
                this._eventListeners[key] = [];
            }
            this._eventListeners[key].push(cb);
        }
    }

    _dispatchEvent(key, value) {
        if (key in this._eventListeners) {
            for (let cb of this._eventListeners[key]) {
                cb(value);
            }
        }
    }

    removeAllListeners(){
        this._removeListeners();
        this._eventListeners = {};
    }

    async start(){
        const {fb} = this;

        this._removeListeners();

        fb.set(`${fb.me}/descriptions`, null);
        fb.set(`${fb.me}/candidates`, null);

        let descriptionRef = `${fb.them}/descriptions`
        this.descriptionListener = fb.onChildAdded(descriptionRef, (description, key) => {
            this._dispatchEvent("description", new RTCSessionDescription(description));
            
            fb.set(descriptionRef + "/" + key, null);
        });
    
        let candidateRef = `${fb.them}/candidates`;
        this.candidateListener = fb.onChildAdded(candidateRef, (candidate, key) => {
            this._dispatchEvent("candidate", new RTCIceCandidate(candidate));

            fb.set(candidateRef + "/" + key, null);
        })

        let initRS = true;
        return await new Promise((r) => {
            this.restartListener = fb.onValue(`${fb.them}/restart-connection`, (val) => {
                if (initRS) {
                    initRS = false;
                    r()
                } else {
                    let time = val == null ? new Date().getTime() : val;
                    this._dispatchEvent("restart", time);
                }
            })
            this._listening = true;
        })
    }

    async restart(){
        await this.fb.set(`${this.fb.me}/restart-connection`, new Date().getTime())
    }

    _removeListeners(){
        this._listening = false;
        if (this.candidateListener instanceof Function) this.candidateListener();
        if (this.descriptionListener instanceof Function) this.descriptionListener();
        if (this.hostUIDListener instanceof Function) this.hostUIDListener();
        if (this.restartListener instanceof Function) this.restartListener();
    }
}