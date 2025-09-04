// import { createDenoisedTrack, makeDenoisedStream } from "./Denoise/makeDenoisedStream.js";
import { getSelectedDevice, setSelectedDevice } from "./device-manager.js";
const camParams2 = {
    video: {
      width: { min: 320, ideal: 640, max: 1920 },
      height: { min: 240, ideal: 480, max: 1080 },
      facingMode: "user",
      deviceId: {
        exact: "abc",
      },
    },
    audio: {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      deviceId: {
        exact: "abc",
      },
    },
};

const camParams1 = {
  video: {
    width: { min: 320, ideal: 640, max: 1920 },
    height: { min: 240, ideal: 480, max: 1080 },
    facingMode: "user",
    deviceId: {
      exact: "abc",
    },
  },
  audio: false,
};
  
const selectedDevices = {
  audioinput: null,
  videoinput: null,
  audiooutput: null,
}


let Canvas = document.createElement("canvas");
let Ctx = Canvas.getContext("2d", {willReadFrequently: true});
let Video = document.createElement("video");
Video.style.setProperty("opacity", "0");
document.body.prepend(Video);
let VideoOnlyStream = null;
let VideoAudioStream = null;
let webcam_on = false;
var stopCapture = false;
let capturing = false;

let ProcessRunning = {};
let Process = {};
let processListeners = {};
  
Video.setAttribute("autoplay", "true");
Video.setAttribute("playsinline", "true");
Video.muted = true;
Video.onunmute = () => {
  console.log('xx');
}
  
  // ~~~~~~~~ HELPFULL METHODS ~~~~~~~~
  async function parallel() {
    let res = [];
    for (let argument of arguments) {
      res.push(await argument);
    }
    return res;
  }
  
  async function nextFrame(){
    return new Promise((resolve, reject) => {
      // setTimeout(resolve, 30);
      window.requestAnimationFrame(resolve);
    })
  }
  
  // ~~~~~~~~ PRIVATE METHODS ~~~~~~~~
  async function runProcess(name = "default"){
    if (name in Process) {
      let input = {video: Video, canvas: Canvas, context: Ctx};
      input.width = Video.videoWidth;
      input.height =Video.videoHeight;
      if (Process[name] instanceof Function){
        try {
          input.result = await Process[name](input);
        } catch (e) {
          input.error = e;
        }
      }
      // let pd = window.performance.now();
      // input.times = {start: t0, capture: t1, process: pd}
      for (let listener of processListeners[name]) {
        try {
          listener(input);
        } catch (e) {
          console.log(e);
        }
      }
    }
  
  }
  
  function captureFrame(){
    Canvas.width = Video.videoWidth;
    Canvas.height = Video.videoHeight;
    Ctx.drawImage(Video, 0, 0, Canvas.width, Canvas.height);
  }
  
  function setUserMediaVariable(){
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }
  
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = async (constraints) => {
  
        // gets the alternative old getUserMedia is possible
        var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  
        // set an error message if browser doesn't support getUserMedia
        if (!getUserMedia) {
          return Promise.reject(new Error("Unfortunately, your browser does not support access to the webcam through the getUserMedia API. Try to use the latest version of Google Chrome, Mozilla Firefox, Opera, or Microsoft Edge instead."));
        }
  
        // uses navigator.getUserMedia for older browsers
        return new Promise((resolve, reject) => {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      }
    }
  }
  
  function isRunning(){
    for (let key in ProcessRunning) {
      if (processListeners[key]) return true;
    }
    return false
  }
  
  async function runProcessingLoop(){
    if (capturing) {
      if (stopCapture) stopCapture = false;
      return;
    }
    capturing = true;
    let lastTime = -1
    while (!stopCapture) {
      await nextFrame();
      let {currentTime} = Video;
      if (currentTime != lastTime) {
        // captureFrame();
        let proms = Object.keys(ProcessRunning)
        .map(k => [k, ProcessRunning[k]])
        .filter(([k, v]) => v)
        .map(a => runProcess(a[0]));
        await parallel(...proms);
      }
      lastTime = currentTime;
    }
    capturing = false;
    stopCapture = false;
  }
  
  // let Filter = null;
  // let AudioContext = null;
  // function createAudioFilteredStream(stream, bandrange = [60, 1000]){
  //   if (!stream) return
  //   // Separate the audio and video tracks
  //   const audioTracks = stream.getAudioTracks();
  //   const videoTracks = stream.getVideoTracks();
  
  //   if (audioTracks.length === 0) {
  //     console.warn("Error filtering audop: No audio tracks found in the stream.");
  //     return;
  //   }
  
  //   // Create an AudioContext for processing audio
  //   const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  //   if (!audioContext) {
  //     console.warn("Audio context not found");
  //     return;
  //   }
  //   AudioContext = audioContext;
  
  //   // Create a MediaStreamSource from the audio track
  //   const audioSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    
  //   // Create a bandpass filter
  //   // Configure High-Pass Filter
  //   const highPass = audioContext.createBiquadFilter();
  //   highPass.type = "highpass";
  //   highPass.frequency.setValueAtTime(200, audioContext.currentTime);
  
  //   // Configure Low-Pass Filter
  //   const lowPass = audioContext.createBiquadFilter();
  //   lowPass.type = "lowpass";
  //   lowPass.frequency.setValueAtTime(3000, audioContext.currentTime);
  
  //   // Configure Compressor
  //   const compressor = audioContext.createDynamicsCompressor();
  //   compressor.threshold.setValueAtTime(-50, audioContext.currentTime);
  //   compressor.knee.setValueAtTime(40, audioContext.currentTime);
  //   compressor.ratio.setValueAtTime(4, audioContext.currentTime);
  //   compressor.attack.setValueAtTime(0.01, audioContext.currentTime);
  //   compressor.release.setValueAtTime(0.1, audioContext.currentTime);
  
  //   // Connect nodes
  //   audioSource.connect(highPass);
  //   highPass.connect(lowPass);
  //   // lowPass.connect(compressor)
  
  //   // Connect the source to the filter and then to the destination
  //   const audioDestination = audioContext.createMediaStreamDestination();
  //   lowPass.connect(audioDestination);
  
  //   // Create a new MediaStream with the original video tracks and the filtered audio track
  //   const processedStream = new MediaStream();
  //   videoTracks.forEach(track => processedStream.addTrack(track)); // Add video tracks
  //   audioDestination.stream.getAudioTracks().forEach(track => processedStream.addTrack(track)); // Add filtered audio track
  
  //   return processedStream
  // }
  
  // window.adjustFilter = (mid, q) => {
  //   Filter.frequency.setValueAtTime(mid, AudioContext.currentTime); 
  //   Filter.Q.setValueAtTime(q, AudioContext.currentTime); 
  // }
 
  // ~~~~~~~~ PUBLIC METHODS ~~~~~~~~

  async function checkPermissions() {
    if (navigator.permissions) {
      let [micPermission, camPermission] = await Promise.all([
        navigator.permissions.query({ name: 'microphone' }),
        navigator.permissions.query({ name: 'camera' }) 
      ]);
      return micPermission.state === 'granted' && camPermission.state === 'granted';
    } else {
      return false;
    }
  }

  export async function updateSelectedDevice(type, deviceId) {
    let [audioinput, videoinput, audiooutput] = await Promise.all([getSelectedDevice("audioinput"), getSelectedDevice("videoinput"), getSelectedDevice("audiooutput")]);
    
    camParams1.video.deviceId.exact = videoinput;
    camParams2.video.deviceId.exact = videoinput;
    camParams2.audio.deviceId.exact = audioinput;
  }
  
  export function setProcess(algorithm, name = "default"){
    if (algorithm instanceof Function) {
      Process[name] = algorithm;
      processListeners[name] = [];
      ProcessRunning[name] = false;
    }
  }
  
  let starting_webcam = false;
  export async function startWebcam(params = camParams1){
    if (webcam_on || starting_webcam) {
      return true;
    }
    starting_webcam = true;
    webcam_on = false;
    try {
      setUserMediaVariable();

      if (!(await checkPermissions())) {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      }

      await updateSelectedDevice();
      
      let stream = await navigator.mediaDevices.getUserMedia( params );
      let stream2 = await navigator.mediaDevices.getUserMedia( camParams2 );
      // stream2 = await makeDenoisedStream(stream2);
      if (!stream) {
        webcam_on = false;
        throw 'no stream'
      }

      VideoOnlyStream = stream;
      VideoAudioStream = stream2;
      VideoOnlyStream.myid = "videoOnlyStream";
      VideoAudioStream.myid = "videoAudioStream";

      console.log("WEBCAM");
      
      
      Video.srcObject = stream;
  
      webcam_on = await new Promise((resolve, reject) => {
        let onload = () => {
          webcam_on = true;
          Video.removeEventListener("loadeddata", onload);
          resolve(true)
        };
        Video.addEventListener("loadeddata", onload);
      });
    } catch (e) {
      console.log(e);
      webcam_on = false;
    }
    if (webcam_on && isRunning()) {
      runProcessingLoop();
    }
    
    starting_webcam = false;
    return webcam_on;
  }
  
  export function stopWebcam(){
    try {
      for (let track of VideoOnlyStream.getTracks()) {
        track.stop();
      }
    } catch(e) {}
    stopProcessingAll();
    webcam_on = false;
  }
  
  export function startProcessing(name = "default") {
    if (name in ProcessRunning) {
  
      ProcessRunning[name] = true;
  
      if (!capturing && webcam_on) {
        runProcessingLoop();
      }
    }
  }
  
  export function stopProcessing(name = "default") {
    ProcessRunning[name] = false;
    if (!isRunning()) stopCapture = true;
  }
  
  export function addProcessListener(listener, name = "default") {
    if (listener instanceof Function) {
      if (!(name in processListeners)) processListeners[name] = []
      processListeners[name].push(listener);
    }
  }
  
  export function copyFrame(destinationCanvas) {
    destinationCanvas.width = Canvas.width;
    destinationCanvas.height = Canvas.height;
    let destCtx = destinationCanvas.getContext('2d');
    destCtx.drawImage(Canvas, 0, 0);
  }
  
  export function isOn(){return webcam_on;}
  
  export function isProcessing(name = "default"){return capturing && ProcessRunning[name];}
  
  export function getStream(i) {
    if (i == 2) {
      return VideoAudioStream;
    } else {
      return VideoOnlyStream;
    }
  }

  export async function changeDevice(type, deviceId) {
    switch (type) {
      case "videoinput":
        if (await setSelectedDevice("videoinput", deviceId)) {
          camParams1.video.deviceId.exact = deviceId;
          camParams2.video.deviceId.exact = deviceId;
          let newStream1 = await navigator.mediaDevices.getUserMedia( camParams1 );
          let newStream2 = await navigator.mediaDevices.getUserMedia( camParams2 );
          if (newStream2 && newStream1) {
            if (VideoOnlyStream) {
              const oldVideoTrack = VideoOnlyStream.getVideoTracks()[0]
              const newVideoTrack = newStream1.getVideoTracks()[0];
              oldVideoTrack.stop(); 
              VideoOnlyStream.removeTrack(oldVideoTrack);
              VideoOnlyStream.addTrack(newVideoTrack);
              const event = new Event("trackchanged");
              event.oldTrack = oldVideoTrack;
              event.newTrack = newVideoTrack;
              if (VideoOnlyStream.ontrackchanged instanceof Function) {
                VideoOnlyStream.ontrackchanged(event);
              }
              VideoOnlyStream.dispatchEvent(event);
            }
            
            if (VideoAudioStream) {  
              const oldVideoTrack = VideoAudioStream.getVideoTracks()[0]
              const newVideoTrack = newStream2.getVideoTracks()[0];
              oldVideoTrack.stop(); 
              VideoAudioStream.removeTrack(oldVideoTrack);
              VideoAudioStream.addTrack(newVideoTrack);
              const event = new Event("trackchanged");
              event.oldTrack = oldVideoTrack;
              event.newTrack = newVideoTrack;
              if (VideoAudioStream.ontrackchanged instanceof Function) {
                VideoAudioStream.ontrackchanged(event);
              }
              VideoAudioStream.dispatchEvent(event);
            }
          }
        }
        break;
      case "audioinput": 
        if (await setSelectedDevice("audioinput", deviceId)) {
          camParams2.audio.deviceId.exact = deviceId;
          let newStream2 = await navigator.mediaDevices.getUserMedia( camParams2 );
          if (newStream2) {
            if (VideoAudioStream) {
              const oldAudioTrack = VideoAudioStream.getAudioTracks()[0]
              const newAudioTrack = newStream2.getAudioTracks()[0];
              oldAudioTrack.stop();
              VideoAudioStream.removeTrack(oldAudioTrack);
              VideoAudioStream.addTrack(newAudioTrack);
              const event = new Event("trackchanged");
              event.oldTrack = oldAudioTrack;
              event.newTrack = newAudioTrack;
              if (VideoAudioStream.ontrackchanged instanceof Function) {
                VideoAudioStream.ontrackchanged(event);
              }
              VideoAudioStream.dispatchEvent(event);
            } 
          }
        }
        break;
      case "audiooutput":
        await setSelectedDevice("audiooutput", deviceId)
        break;
    }
  }
 