import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'

import {
        getAuth, 
        signOut as sOut, 
        sendPasswordResetEmail as sendPRE, 
        signInAnonymously as signInAnom,
        createUserWithEmailAndPassword as createUserEandP, 
        signInWithEmailAndPassword as signInEandP, 
        reauthenticateWithCredential, 
        updatePassword, 
        signInWithRedirect, 
        GoogleAuthProvider, 
        EmailAuthProvider,
        onAuthStateChanged, 
        sendEmailVerification as _sendEmailVerification} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'

import {
        update, 
        getDatabase, 
        child, 
        push, 
        ref as _ref, 
        get, 
        onValue, 
        onChildAdded, 
        onChildChanged, 
        onChildRemoved, 
        set, 
        off,
        query, 
        endAt, 
        endBefore, 
        equalTo, 
        startAfter, 
        orderByKey,
        orderByValue, 
        orderByChild, 
        limitToFirst, 
        limitToLast } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js'
import { getFunctions, 
         httpsCallable  } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js'
import { getStorage, 
         ref as sref, 
         uploadBytesResumable, 
         getDownloadURL, 
         getBlob, 
         getMetadata } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js'



const firebaseConfig = {
    apiKey: "AIzaSyChiEAP1Rp1BDNFn7BQ8d0oGR65N3rXQkE",
    authDomain: "eyesee-d0a42.firebaseapp.com",
    databaseURL: "https://eyesee-d0a42-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "eyesee-d0a42",
    storageBucket: "eyesee-d0a42.appspot.com",
    messagingSenderId: "56834287411",
    appId: "1:56834287411:web:999340ed2fd5165fa68046"
};
const storageURL = "gs://eyesee-d0a42.appspot.com"

let initialised = false;
let initialising = false;

let App = null;
let Database = null;
const Functions = {
    "asia-southeast1": null,
    "australia-southeast1": null,
};
let Storage = null;
let Auth = null;
let User;
let StateListeners = [];
let waitForUserProm = null;


// Generates a random key to use as the device's unique identifier DUID.
function makeRandomKey(){
  return  (Math.round(Math.random() * 100000)).toString(32) + Math.round(performance.now() * 1000).toString(32) + (Math.round(Math.random() * 100000)).toString(32);
}

/* If a DUID already exists in local storage retreive that key otherwise generate a new key 
   and store in local storage. */ 
let DUID = localStorage.getItem('duid');
if (DUID == null) {
  DUID = makeRandomKey();
  localStorage.setItem('duid', DUID);
}

/* If the user has changed updates the new user and calls all listeners with the new user data.
   If a listener returns the string "remove" then the listener will be removed */
function authChangeHandler(user){
  // If the user has changed
  if (user !== User) {
    // Update the user object
    User = user;
    let newListeners = [];
    // Call listeners with the new user
    for (let listener of StateListeners) {
        if (listener.active) {
            listener.callback(User);
            newListeners.push(listener);
        }
    }
    StateListeners = newListeners;
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/*  Initialize firebase, initializes the firebase app with the given configuration
    after initializing wait for an auth state change and return */
export async function initialise(config = firebaseConfig) {
  if (initialised || initialising) return await waitForUserProm;
  initialising = true;

  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();

  Storage = getStorage(App, storageURL);
  for (let key in Functions) Functions[key] = getFunctions(App, key);
  waitForUserProm = new Promise((r) => {
    onAuthStateChanged(Auth, async (userData) => {
      authChangeHandler(userData);
      initialising = false;
      initialised = true;
      r(userData);
    });
  });
  return await waitForUserProm;
}
// Get App object
export function getApp(){return App;}

// Get Database object
export function getDB(){return Database; }


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ AUTHENTICATION ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//  Add an auth state change listener
export function addAuthChangeListener(obj) {
    let callbacks = [];
    let unsubscriber = null;
    if (obj instanceof Function) {
        callbacks.push(obj);
    } else if (typeof obj === "object" && obj !== null) {
        if (obj.onauthchange instanceof Function) {
            callbacks.push(obj.onauthchange.bind(obj));
        }
        if (obj instanceof Element) {
            callbacks.push((user) => {
                const event = new Event("authchange");
                event.user = user;
                obj.dispatchEvent(event)
            })
        }   
    }

    if (callbacks.length > 0) {
        let callback = (data) => callbacks.forEach(cb => cb(data))
        let listener = {
            callback,
            active: true,
        }
        unsubscriber = () => {
            listener.active = false;
        }
        listener.unsubscriber = unsubscriber;
        StateListeners.push(listener);

        if (initialised) {
            callback(User);
        }
    }

    return unsubscriber;
}

// Get user uid, if none exists then the DUID is returned instead
export function getUID(){
  let uid = DUID;
  if (User != null && typeof User !== "string") {
    uid = User.uid;
  }
  return uid;
}

// Get user data object
export function getUser(){return User;}


export function signInWithEmailAndPassword(email, password){
    signInEandP(Auth, email, password)
}

export async function sendEmailVerification(url = window.location.origin){
    // Send email verification
    if (User) {
        const actionCodeSettings = {
            url,
            handleCodeInApp: true
        };
        await _sendEmailVerification(User, actionCodeSettings);
    }
}

export async function sendPasswordResetEmail(email){
    await sendPRE(Auth, email, {
        url: window.location.origin,
        handleCodeInApp: true
    })
}

export async function createUserWithEmailAndPassword(email, password) {
    await createUserEandP(Auth, email, password);
}

export async function signInAnonymously(){
    await signInAnom(Auth);
}

export async function signOut(){
    sOut(Auth);
}
window.signOut = signOut
window.signIn = signInWithEmailAndPassword
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ REALTIME DATABASE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Get Ref using database
export function ref(path) {return _ref(Database, path);}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export async function callFunction(name, data, location = "australia-southeast1") {
  let res = null;
  if (location in Functions && Functions[location] !== null){
    
    const func = httpsCallable(Functions[location], name);
    res = await func(data);
  }
  return res;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STORAGE DATABASE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export function storageRef(fileName){
    return sref(Storage, fileName);
}

// Upload file to firebase storage bucket
export async function uploadFileToCloud(file, path, statusCallback, metadata, getURL = true) {
  console.log("uploading file of size", (file.size / 1e6) + "MB");

  if (!(file instanceof File) || typeof path !== 'string') {
      console.log('invalid file');
      return null;
  }

  if (!(statusCallback instanceof Function))
      statusCallback = () => { }

  let sr = storageRef(path)


  let uploadTask = uploadBytesResumable(sr, file, metadata);
  uploadTask.on('next', statusCallback)
  await uploadTask;

  if (getURL) {
      let url = await getDownloadURL(sr);
      return url;
  }
  return null
}

export async function getFile(path) {
  return await getBlob(storageRef(path));
}

export {
        reauthenticateWithCredential, 
        updatePassword, 
        signInWithRedirect, 
        GoogleAuthProvider, 
        EmailAuthProvider,
        getMetadata,

        update,
        child,
        get,
        push,
        set,
        onChildAdded,
        onChildRemoved,
        onChildChanged,
        onValue,
        query,
        endAt,
        endBefore,
        equalTo,
        startAfter,
        orderByKey,
        orderByValue,
        orderByChild,
        limitToFirst,
        limitToLast
}
