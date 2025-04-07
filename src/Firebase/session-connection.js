import { delay } from "../Utilities/usefull-funcs.js";
import { callFunction, getUID } from "./firebase.js";
import { FirebaseFrame } from "./firebase-frame.js";
import { SvgPlus } from "../SvgPlus/4.js";

const UPDATE_CYCLE_TIME_MS = 3 * 60 * 1000;

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
        while (this.hasJoined) {
            let key = this.isHost ? "host" : getUID();
            this.set(`updates/${key}`, (new Date().getTime()));
            await delay(UPDATE_CYCLE_TIME_MS);
        }
    }


    get userName() {
        return this.isHost ? "host" : "participant";
    }

    get isHost(){
        return this.hostUID === getUID();
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
        
        if (!isActive) {
            
            if (host === null) {
                
                error = [ERROR_CODES.NO_SESSION, "This session no longer exists."]
            } else if (isHost) {
                // start session if host 
                let {data: {errors}} = await callFunction("sessions-start", {sid: this.sid});
                
                if (errors.length === 0) {
                    start = true;
                } else {
                    error = errors[0];
                }
            } else {
                // session has not started and participant requesting
                // to join session
                error = [ERROR_CODES.SESSION_NOT_STARTED, "Host has not started the session."]
            }
        } else {
            if (!isHost) {
                let participant = await this.get("participants/"+getUID());

                // If user is not approved
                if (participant == null) {
                    try {
                        await this.set("requests/"+getUID(), "anon");
                    } catch (e) {}
                    error = [ERROR_CODES.WAITING_APPROVAL, "The host has not yet approved you."]
                } else {
                    start = true;
                }
            } else {
                start = true
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