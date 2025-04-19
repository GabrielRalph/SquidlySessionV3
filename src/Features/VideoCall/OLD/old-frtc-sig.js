import {set, get, ref,update, push, child, getDB, getUID, onChildAdded, onChildRemoved, onChildChanged, onValue, callFunction, uploadFileToCloud, initialise} from "./firebase-basic.js"

const SESSION_ROOT_KEY = "sessions";

let UserType = null;
let hasJoined = false;
let CurrentSessionKey = null;
let CandidateListener = null;
let Listening = null;
let DescriptionListener = null;
let HostUIDListener = null;
let FieldListeners = [];
let FirebaseFrames = [];

let TickIntervalID = null;
let messageHandler = () => {};

async function sendTick(key){
  let res = await callFunction("sendTick", {sid: key})
  if (res.data != null) {
    messageHandler({data: {usage: res.data}});
  }
}

function getSessionRef(sessionID, path) {
  let Database = getDB();
  let sref = null;
  if (Database != null) {
    if (typeof sessionID === "string") {
      sref = ref(SESSION_ROOT_KEY + "/" + sessionID);
      if (typeof path === "string") sref = child(sref, path);
    } else {
      sref = push(ref(SESSION_ROOT_KEY));
    }
  }
  return sref;
}

async function getHostUID(key){
  let uid = null;
  for (let trys = 0; trys < 5; trys++){
    let uidRef = getSessionRef(key, "hostUID");
    if (uidRef == null) {
      throw "Database has not been initialised";
    }
    try{
      uid = (await get(uidRef)).val();
      return uid;
    } catch(e) {
      console.log(e);
    }
  }
  throw "Failed to connect to signaling server.";
}

// remove signaling channel listeners
function removeListeners(){
  Listening = false;
  if (CandidateListener instanceof Function) CandidateListener();
  if (DescriptionListener instanceof Function) DescriptionListener();
  if (HostUIDListener instanceof Function) HostUIDListener();
  while(FieldListeners.length > 0) {
    let listener = FieldListeners.pop();
    if (listener instanceof Function) listener();
  }
  if (TickIntervalID != null) clearInterval(TickIntervalID);
}


export const STATE_FIELDS = [
  {
    field: "content",
    from: "host",
    messageKey: "contentInfo"
  },
  {
    field: "bubbleState",
    from: "both",
    messageKey: "bubbleState",
  },
  {
    field: "contentTransform",
    from: "host",
    messageKey: "contentTransform"
  },
  {
    field: "participantView",
    from: "both",
    messageKey: "participantView"
  },
  {
    field: "aspectRatio",
    from: "participant",
    messageKey: "aspectRatio"
  },
  {
    field: "appInfo",
    from: "both",
    messageKey: "appInfo"
  }
]

async function addStateFieldListener(s, key, userType){
  let listener = null;
  let fieldRef = getSessionRef(key, s.field);
  if (userType == s.from) {
    // Get field state once at the start for the sender of this field
    let fieldVal = (await get(fieldRef)).val();
    if (fieldVal != null) {
      messageHandler({data: {fieldState: {[s.messageKey]: fieldVal}}});
    }
  } else {
    // Watch field for the recipient of the field
    listener = onValue(fieldRef, (sc) => {
      let fieldVal = sc.val();
      messageHandler({data: {fieldState: {[s.messageKey]: fieldVal}}})
    })
    FieldListeners.push(listener);
  }
}



const TICK_TIMEOUT_MINUTES = 5;
// add signaling channel listeners
function addListeners(key, userType){
  // Unsubscribe any previous listeners
  removeListeners();

  // Listen to the oposite user type
  let listenTo = userType == "host" ? "participant" : "host"

  sendTick(key);
  TickIntervalID = setInterval(async () => {
    sendTick(key);
  }, TICK_TIMEOUT_MINUTES * 60*1000)

  let hostUIDRef = getSessionRef(key, "hostUID");
  HostUIDListener = onValue(hostUIDRef, (sc) => {
    if (sc.val() == null) {
      messageHandler({data: {
        session_ended: true,
      }})
    }
  });


  for (let s of STATE_FIELDS) {
    addStateFieldListener(s, key, userType);
  }

  let descriptionRef = getSessionRef(key, `${listenTo}/description`);
  DescriptionListener = onChildAdded(descriptionRef, (sc) => {
    messageHandler({
      data: {
        description: new RTCSessionDescription(sc.val())
      }
    })
    set(child(descriptionRef, sc.key), null);
  });

  let candidateRef = getSessionRef(key, `${listenTo}/candidates`);
  CandidateListener = onChildAdded(candidateRef, (sc) => {
    messageHandler({
      data:{
        candidate: new RTCIceCandidate(sc.val())
      }
    })
    set(child(candidateRef, sc.key), null);
  });

  UserType = userType;
  CurrentSessionKey = key;
  Listening = true;
}

// Reomve session
export async function remove(bytes){
  await callFunction("endSession", {sid: CurrentSessionKey, bytes: bytes});
}

export async function waitForHost(key) {
  return new Promise((resolve, reject) => {
    let stopOnValue = onValue(getSessionRef(key, "iceServers"), (sc) => {
      if (sc.val() != null) {
        stopOnValue();
        resolve(sc.val());
      }
    })
  })
}

/* Join session joins the given session key, if forceParticipant is set true
   the user will join as participant otherwise the user will join as a host
   if they are the host or participant if not. */
export async function join(key, onmessage, forceParticipant = false) {
  let hostUID = await getHostUID(key);
  if (hostUID == null) {
    throw "No session exists for this session link."
  }

  let asParticipant = !((hostUID == getUID()) && (!forceParticipant));

  // let time = (await get(getSessionRef(key, "time"))).val();
  // console.log(new Date(time) + "");
  
  let iceServers = (await get(getSessionRef(key, "iceServers"))).val();
  if (iceServers == null) {
    if (asParticipant) {
      let error = new Error("Host has not started the session yet, please wait for the host to begin.");
      error.waitForHost = true;
      throw error;
    } else {
      let {data} = await callFunction("startSession", {sid: key});
      if (data.error != null || data.iceServers == null) {
        let names = "";
        if (data.error.startsWith("Usage exceeded")) names = data.error.replace("Usage exceeded ", "")
        throw `You cannot host a meeting currently, please check your ${names} usage.`
      } 
      iceServers = data.iceServers;
    }
  }

  if (onmessage instanceof Function) messageHandler = onmessage;

  let userType = asParticipant ? "participant" : "host";

  let initialState = {};
  for (let key of ["Video", "Audio"]) {
    let value = (await get(ref(`users/${hostUID}/info/${userType + key}`))).val();
    initialState[key.toLocaleLowerCase()] = value === false;
  }
  for (let key of ["displayName", "displayPhoto", "pronouns"]) {
    initialState[key] = (await get(ref(`users/${hostUID}/info/${key}`))).val();
  }
  
  addListeners(key, userType);
  
  hasJoined = true;
  for (let fframe of FirebaseFrames) {
    fframe.onconnect();
  }

  return {iceServers, initialState};
}

/* Leave the current session */
export function leave(){
  UserType = null;
  CurrentSessionKey = null;
  for (let fframe in FirebaseFrames) fframe.close();
  hasJoined = false;
}

/* Send WebRTC descriptions or candiates accros signaling channel */
export async function send({description, candidate}) {
  if (CurrentSessionKey && UserType) {
    let userRef = getSessionRef(CurrentSessionKey, UserType);
    if (description) {
      let descriptionRef = push(child(userRef, "description"));
      await set(descriptionRef, description.toJSON());
    } else if (candidate) {
      let candidateRef = push(child(userRef, "candidates"));
      await set(candidateRef, candidate.toJSON());
    }
  }
}

export async function uploadSessionContent(file, callback) {
  if (file instanceof File || file == null) {
    // upload content
    let contentRef = getSessionRef(getKey(), "content");
    set(child(contentRef, "page"), 1);
    if (file == null) {
      set(contentRef, null);
    } else {
      let url = await uploadFileToCloud(file, `/session-content/${getKey()}`, (uts) => {
        if (callback instanceof Function)
          callback(uts.bytesTransferred / uts.totalBytes)
      })
      // set content info
      let type = file.type.indexOf("pdf") == -1 ? "image" : "pdf";
      update(contentRef, {
        url, 
        type,
      })
    }
  }
}

export function setSessionStateField(field, value) {
  let fieldRef = getSessionRef(getKey(), field, value);
  set(fieldRef, value);
}

export function changeSessionContentPage(page) {
  let contentRef = getSessionRef(getKey(), "content/page");
  set(contentRef, page);
}

// returns wheather the user is a participant in the current session
export function isPolite(){
  if (UserType == null) return null;
  else return UserType !== "host"
}

export function getKey(){
  return CurrentSessionKey;
}

export function getUserType(){
  return UserType;
}


/**
 * @param {String} appName
 * @param {Object} app
 */
export function addAppDatabase(appName, app = {}) {
  if (typeof appName === "string" && typeof app === "object" && app !== null) {


      let appRef = (path) => {
        let r = getSessionRef(getKey(), "app-" + appName);
        if (typeof path === "string") r = child(r, path);
        return r;
      }
      let listeners = [];
    
      
      let funcs = {
        get: async (path) => (await get(appRef(path))).val(),
        set: (path, value) => set(appRef(path), value),
        push: (path) => {
          console.log("here");
          let pr = push(appRef(path));
          return pr.key;
        },
        onValue: (path, cb) => {
          if (cb instanceof Function) {
            listeners.push(onValue(appRef(path), (sc) => cb(sc.val())))
          } else {
            throw "The callback must be a function"
          }
        },
        onChildAdded: (path, cb) => {
          console.log(appRef(path));
          if (cb instanceof Function) {
            listeners.push(onChildAdded(appRef(path), (sc, key) => cb(sc.val(), sc.key, key) ))
          } else {
            throw "The callback must be a function"
          }
        },
        onChildRemoved: (path, cb) => {
          if (cb instanceof Function) {
            listeners.push(onChildRemoved(appRef(path), (sc) => cb(sc.val(), sc.key)))
          } else {
            throw "The callback must be a function"
          }
        },
        onChildChanged: (path, cb) => {
          if (cb instanceof Function) {
            listeners.push(onChildChanged(appRef(path), (sc, key) => cb(sc.val(), sc.key, key)))
          } else {
            throw "The callback must be a function"
          }
        },
        close: () => {
          for (let listener of listeners) listener();
          set(appRef(), null);
        },
        kwajo: "here"
      };

  
      for (let key in funcs) {
        app[key] = funcs[key]

      }
    }
}

/** 
 * @typedef {(String|Array|Number|Object)} DataValue 
 * @typedef {('host'|'participant'|'both')} UserType
 * */


/**
 * @param {String} appName
 * @param {Object} app
 */
export class FirebaseFrame {
  constructor(reference) {

      this.appRef = (path) => {
        let r = getSessionRef(getKey(), "app-" + reference);
        if (typeof path === "string") r = child(r, path);
        return r;
      }
      this.listeners = new Set();
      FirebaseFrames.push(this);
      if (hasJoined) {
        this.onconnect();
      }
  }

  get isConnected(){
    return !!hasJoined;
  }

  logPath() {
      console.log(this.appRef("hello"));
  }

  /**
   * Called when firebase is connected to a session
   */
  onconnect(){
  }
  

  /** get, gets a value in the apps database at the path specified.
   * 
   * @param {String} path the path in the database you want to access if no 
   *                      path is provided then the app's root directory is fetched.
   * @return {Promise<DataValue>} returns a promise that resolves the value in the database.
   */
  async get(path){ 
    if (hasJoined) return (await get(this.appRef(path))).val()
    else throw "Session has not connected"
  }


  /** set, sets a value in the apps database at the path specified.
   * @param {String} path same as with get.
   * @return {Promise<void>} returns a promise that resolves nothing once setting has been completed.
   * 
   */
  async set(path, value) {
    if (hasJoined) await set(this.appRef(path), value)
    else throw "Session has not connected"
  }

  /** push, gets a new push key for the path at the database
   * 
   * @param {String} path same as with get.
   * @return {String} returns the key to push a new value.
   */
  push(path) {
    if (hasJoined) {
      let pr = push(this.appRef(path));
      return pr.key;
    } else {
      throw "Session has not connected"
    }
  }

  /** An onValue event will trigger once with the initial data stored at this location, and then trigger
   *  again each time the data changes. The value passed to the callback will be for the location at which
   *  path specifies. It won't trigger until the entire contents has been synchronized. If the location has
   *  no data, it will be triggered with a null value.
   * 
   * @param {String} path same as with get.
   * @param {(value: DataValue) => void} callback a function that will be called at the start 
   *                                                        and for every change made.
   */
  onValue(path, cb) {
    if (hasJoined) {
        let close = null;
        if (cb instanceof Function) {
            close = onValue(this.appRef(path), (sc) => cb(sc.val()));
            this.listeners.add(close)
        } else {
            throw "The callback must be a function"
        }
        return () => {
            this.listeners.delete(close);
            close();
        };
      } else {
        throw "Session has not connected"
      }
  }

  /** An onChildAdded event will be triggered once for each initial child at this location, and it will be 
   *  triggered again every time a new child is added. The value passed into the callback will reflect
   *  the data for the relevant child. It is also passed a second parameter the key of the child added.
   *  For ordering purposes, it is passed a third argument which is a string containing the key of the
   *  previous sibling child by sort order, or null if it is the first child.
   * 
   * @param {String} path same as with get.
   * @param {(value: DataValue, key: String, previousKey: String) => void} callback 
   */
  onChildAdded(path, cb) {
      if (hasJoined) {
        let close = null;
        if (cb instanceof Function) {
            close = onChildAdded(this.appRef(path), (sc, key) => cb(sc.val(), sc.key, key));
            this.listeners.add(close)
        } else {
            throw "The callback must be a function"
        }
        return () => {
            this.listeners.delete(close);
            close();
        };
      } else {
        throw "Session has not connected"
      }
  }

  /** An onChildRemoved event will be triggered once every time a child is removed. 
   *  The value passed into the callback will be the old data for the child that was removed.
   *  A child will get removed when it is set null. It is also passed a second parameter the 
   * key of the child removed.
   * 
   * @param {String} path same as with get.
   * @param {(value: DataValue, key: String) => void} callback
   */
  onChildRemoved(path, cb) {
    if (hasJoined) {
      let close = null;
      if (cb instanceof Function) {
          close = onChildRemoved(this.appRef(path), (sc) => cb(sc.val(), sc.key));
          this.listeners.add()
      } else {
          throw "The callback must be a function"
      }
      return () => {
          this.listeners.delete(close);
          close();
      };
    } else {
      throw "Session has not connected"
    }
  }

  /** An onChildChanged event will be triggered initially and when the data stored in a child 
   * (or any of its descendants) changes. Note that a single child_changed event may represent 
   * multiple changes to the child. The value passed to the callback will contain the new child 
   * contents. It is also passed a second parameter the key of the child added. For ordering 
   * purposes, the callback is also passed a third argument which is a string containing the 
   * key of the previous sibling child by sort order, or null if it is the first child.
   * @param {String} path same as with get.
   * @param {(value: DataValue, key: String, previousKey: String) => void} callback
   */
  onChildChanged(path, cb) {
    if (hasJoined) {
      let close = null;
      if (cb instanceof Function) {
        close = onChildChanged(this.appRef(path), (sc, key) => cb(sc.val(), sc.key, key));
        this.listeners.add(close)
      } else {
        throw "The callback must be a function"
      }
      return () => {
        this.listeners.delete(close);
        close();
      };
    } else {
      throw "Session has not connected"
    }
  }

  /** Ends all listeners and removes the app database */
  close(remove = true) {
      for (let listener of this.listeners) listener();
      if (remove) set(this.appRef(), null);
  }

  get uid(){
    return getUID();
  }
}