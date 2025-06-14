import { delay } from "../Utilities/usefull-funcs.js";
import { callFunction, getUID } from "./firebase.js";
import { FirebaseFrame } from "./firebase-frame.js";
import { SvgPlus } from "../SvgPlus/4.js";

const UPDATE_CYCLE_TIME_MS = 3 * 1000;
const MAX_TIME_SINCE_PING = 5 * 1000;


window.createSession = async () => {
    let res = await callFunction("sessions-create", {startTime: 123});
    let sessionID = res.data.sid;
    if (sessionID == null) {
        console.log(res);
    } else {
        window.location = window.location.origin + "/?" + sessionID;
    }
}

export const ERROR_CODES = {
    REQUEST_DATA: 0,
    REQUEST_AUTH: 1,
    PERMISSIONS: 2,
    NO_SESSION: 3,
    NOT_HOST: 4,
    NO_REQUEST: 5,
    IN_SESSION: 6,

    SESSION_NOT_STARTED: 7,
    JOINING_IN_PROCESS: 8,
    WAITING_APPROVAL: 9,
}

export class SessionConnection extends FirebaseFrame {
    hasJoined = false;
    isJoining = false;
    hostUID = null;
    activeUsers = {};
    userUpdateListeners = {}

    /** @type {string} */
    sid;
    constructor(sid){
        if (sid === null) {
            throw "No SID"
        }
        super(`sessions-v3/${sid}`);
        this.sid = sid;
    }

    async waitForStart(){
        await new Promise((resolve) => {
            let end = this.onValue("active", (value) => {
                if (value === true) {
                    end();
                    resolve(true);
                }
            })
        })
    }

    async waitForApproval(){
        await new Promise((resolve) => {
            let end = this.onValue("participants/"+getUID(), (value) => {
                if (value != null) {
                    end();
                    resolve(true);
                }
            })
        })
    }

    async startUpdating(){
        let makeTimeout = (key) => {
            return setTimeout(() => {
                this.activeUsers[key].active = false;
                this._triggerEvent("left", key, "timeout");
            }, MAX_TIME_SINCE_PING)
        }

        let onChange = (time, uid) => {
            const key = uid == "host" ? "host" : "participant";
            const {activeUsers} = this;

            if (time != null) {
                let dt = new Date().getTime() - time;
                if (dt > MAX_TIME_SINCE_PING) {
                   time = null;
                }
            }
            
            // If the user is not in the active users list, add them
            if (!(key in activeUsers)) {
                if (time !== null) {
                    this.activeUsers[key] = {
                        timeOfLastPing: time, 
                        timeout: makeTimeout(key),
                        active: true,
                    }   
                    this._triggerEvent("joined", key);
                }
            
            // If the user is in the active users list, update their time
            } else {
                // If the user has left, remove them from the list
                if (time == null) {
                    this.activeUsers[key].active = false;
                    this.activeUsers[key].timeOfLastPing = null;
                    clearTimeout(this.activeUsers[key].timeout);
                    this._triggerEvent("left", key, "null");
                
                // If the user is still active, update their time
                } else {
                    let joined = !this.activeUsers[key].active
                    
                    this.activeUsers[key].active = true;
                    this.activeUsers[key].timeOfLastPing = time;
                    clearTimeout(this.activeUsers[key].timeout);
                    this.activeUsers[key].timeout = makeTimeout(key);

                    if (joined) {
                        this._triggerEvent("joined", key, "pingback");
                    }
                }
            }
        }
    
        this.onChildChanged("updates", onChange);
        this.onChildAdded("updates", onChange);
        this.onChildRemoved("updates", (_, key) => onChange(null, key));
        
        // Start the ping loop
        while (this.hasJoined) {
            let key = this.isHost ? "host" : getUID();
            this.set(`updates/${key}`, (new Date().getTime()));
            await delay(UPDATE_CYCLE_TIME_MS);
        }
    }

    isActive(key){
        if (key in this.activeUsers) {
            return this.activeUsers[key].active;
        } else {
            return false;
        }
    }

    _triggerEvent(type, ...args){
        console.log("%c" + args.join(" "), `background:rgb(33, 32, 32); color: ${type == "joined" ? "#bada55" : "#ff7b7b"}; padding: 10px; border-radius: 10px;`);
        if (type in this.userUpdateListeners) {
            for (let listener of this.userUpdateListeners[type]) {
                listener(...args);
            }
        }
    }

    addUserUpdateListener(type, listener) {
        if (listener instanceof Function) {
            if (!(type in this.userUpdateListeners)) {
                this.userUpdateListeners[type] = [];
            }
            this.userUpdateListeners[type].push(listener);
        }
    }

    get isHost(){
        return this.hostUID === getUID();
    }

    get iceServers(){
        return this._iceServers || {
            iceServers: [
                {urls: "stun:stun.l.google.com:19302"},
                {urls: "stun:stun1.l.google.com:19302"},
                {urls: "stun:stun2.l.google.com:19302"},
                {urls: "stun:stun3.l.google.com:19302"},
                {urls: "stun:stun4.l.google.com:19302"},
            ]
        }
    }

    async join(){
        if (this.hasJoined || this.isJoining) return [ERROR_CODES.JOINING_IN_PROCESS];
        this.isJoining = true;

        let start = false;
        let error = [false, ""]
        let isActive = await this.get("active");
        let host = await this.get("hostUID");
        let isHost = host === getUID();

        this.hostUID = host;
        
        // If the session is not active
        if (!isActive) {
            
            // If the session has no host then the session does not exist
            if (host === null) {
                error = [ERROR_CODES.NO_SESSION, "This session no longer exists."]
            
            // Otherwise if the user is the host of the session
            } else if (isHost) {
                // start session if host 
                let {data} = await callFunction("sessions-start", {sid: this.sid});
                
                let errors = data.errors || [];
                if (errors.length === 0) {
                    start = true;
                    this._iceServers = {iceServers: data.iceServers};
                } else {
                    error = errors;
                }

            // Otherwise the user is a participant and the session has not started
            } else {
                // session has not started and participant requesting
                // to join session
                error = [ERROR_CODES.SESSION_NOT_STARTED, "Host has not started the session."]
            }
            

        // The session is active
        } else {
            // If the user is not the host, check if they are already in the session
            if (!isHost) {
                // Check the 
                let participant = await this.get("participants/"+getUID());

                // If user is not approved make a request to join
                if (participant == null) {
                    try {
                        await this.set("requests/"+getUID(), "anon");
                    } catch (e) {}
                    error = [ERROR_CODES.WAITING_APPROVAL, "The host has not yet approved you."];

                // If the user is already in the session, then they can join
                } else {
                    start = true;
                }
            } else {
                start = true
            }

            if (start) {
                let iceServers = await this.get("iceServers");
                if (iceServers != null) {
                    this._iceServers = iceServers;
                }
            }
        }


        if (start) {
            this.hasJoined = true;
            this.onValue("active", (value) => {
                if (value === null) this._onLeave()
            })

            if (isHost) {
                // If Host, Approve all incoming requests.
                this.onValue("requests", async (value) => {
                    if (value != null) {
                        console.log("approving requests");
                        
                        let res = await Promise.all(Object.keys(value).map(async uid => {
                            return await callFunction("sessions-approveRequest", {uid, sid: this.sid})
                        }));
                        console.log(res);
                        
                    }
                })
            }

            this.startUpdating();
        }
        this.isJoining = false;

        return error;
    }

    _onLeave(){
        if (this.onleave instanceof Function) {
            this.onleave();
        }

        this.close();
        this.hasJoined = false;
    }

    async leave(){
        if (this.isHost) {
            await callFunction("sessions-end", {sid: this.sid});
        }
    }
}