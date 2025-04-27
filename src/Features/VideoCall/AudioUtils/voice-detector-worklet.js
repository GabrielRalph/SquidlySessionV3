// Save as 'voice-detector-worklet.js'
class VoiceDetectorProcessor extends AudioWorkletProcessor {
    threshold = 0.02; // Adjust for sensitivity
    talking = false;
    ewa_lambda = 0.05;
    min_talk_time = 1500;
    ewa_v = 0;
    timeOfTalk = 0;
    constructor() {
      super();
    }
  
    process(inputs) {
      const input = inputs[0];
      if (input.length > 0) {
        const channelData = input[0]; // Mono input assumed
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] ** 2;
        }

        const rms = Math.sqrt(sum / channelData.length);

        this.ewa_v = this.ewa_v * (1 - this.ewa_lambda) + rms * this.ewa_lambda;
        
        const isTalking = this.ewa_v > this.threshold;
        let broadcast = false;
        if (isTalking && !this.talking) {
            this.timeOfTalk = new Date().getTime();
            broadcast = true;
        } else if (!isTalking && this.talking) {
            let t0 = new Date().getTime();
            if (t0 - this.timeOfTalk > this.min_talk_time) {
                broadcast = true;
            }
        }
  
        if (broadcast) {
          this.talking = isTalking;
          this.port.postMessage({ talking: isTalking });
        }
      }
  
      return true;
    }
  }
  
  registerProcessor('voice-detector', VoiceDetectorProcessor);