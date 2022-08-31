class WhiteNoiseProcessor extends AudioWorkletProcessor {
  process (inputs, outputs, parameters) {
    const output = outputs[0]
    output.forEach((channel) => {
      for (let i = 0; i < channel.length; i+=1) {
        channel[i] = Math.random() * 2 - 1;
      }
    })
    return true;
  }
}

class OnePoleProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'frequency',
      minValue: 0.0,
      maxValue: sampleRate / 2,
      defaultValue: 440,
    }];
  }
  
  constructor() {
    super();
    this.setCoefficients_(440);
  }
  
  setCoefficients_(frequency) {
    this.b1_ = Math.exp(-2 * Math.PI * frequency / sampleRate);
    this.a0_ = 1.0 - this.b1_;
    this.z1_ = 0;
  }

  process (inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0]
    
    const frequency = parameters.frequency;
    const isFrequencyConstant = frequency.length === 1;

    for (let channel = 0; channel < output.length; channel += 1) {
      const channel_in = input[channel];
      const channel_out = output[channel];
      
      if (isFrequencyConstant) {
        this.setCoefficients_(frequency[0]);
      }

      for (let i = 0; i < channel_out.length; i+=1) {
        if (!isFrequencyConstant) {
          this.setCoefficients_(frequency[i]);
        }
        
        this.z1_ = channel_in[i] * this.a0_ + this.z1_ * this.b1_;
        channel_out[i] = this.z1_;
      }
    }

    return true;
  }
}

class OnePoleHighpassProcessor extends OnePoleProcessor {
  setCoefficients_(frequency) {
    this.b1_ = -Math.exp(-2 * Math.PI * (0.5 - frequency) / sampleRate);
    this.a0_ = 1.0 + this.b1_;
    this.z1_ = 0;
  }
}

registerProcessor('white-noise-processor', WhiteNoiseProcessor);
registerProcessor('one-pole-lowpass', OnePoleProcessor);
registerProcessor('one-pole-highpass', OnePoleHighpassProcessor);
