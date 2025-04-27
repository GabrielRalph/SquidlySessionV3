import { relURL } from "../../../Utilities/usefull-funcs.js";

export async function setupVoiceDetection(stream, cb) {
    const audioContext = new AudioContext();
  
    // Load the worklet
    await audioContext.audioWorklet.addModule(relURL('voice-detector-worklet.js', import.meta));
  
    // Create a MediaStreamSource from input stream
    const source = audioContext.createMediaStreamSource(stream);
  
    // Create the audio worklet node
    const workletNode = new AudioWorkletNode(audioContext, 'voice-detector');
  
    // Listen for messages from the worklet
    let isTalking = false;
    workletNode.port.onmessage = (event) => {
      if (event.data.talking !== undefined) {
        if (isTalking !== event.data.talking) {
            isTalking = event.data.talking;
            cb(isTalking);
        }
      }
    };
  
    // Connect the nodes
    source.connect(workletNode).connect(audioContext.destination); // Optional destination
  }
  