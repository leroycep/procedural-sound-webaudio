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
    this.z1_ = 0;
  }

  setCoefficients_(fHz) {
    let frequency = fHz / sampleRate;
    this.b1_ = Math.exp(-2 * Math.PI * frequency);
    this.a0_ = 1.0 - this.b1_;
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

class OnePoleHighpassProcessor extends AudioWorkletProcessor {
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
    this.last = 0;
  }

  setCoefficients_(fHz) {
    this.coef = 1 - fHz * (2 * Math.PI) / sampleRate;
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

        if (this.coef < 1) {
          let normal = (1 + this.coef);
          let current = channel_in[i] + this.coef * this.last;
          channel_out[i] = normal * (current - this.last);
          this.last = current;
        } else {
          channel_out[i] = channel_in[i];
        }
      }
    }

    return true;
  }
}

class ClipProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'low',
        defaultValue: -1.0,
      },
      {
        name: 'high',
        defaultValue: 1.0,
      }
    ];
  }

  process (inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0]

    for (let channel = 0; channel < output.length; channel += 1) {
      const channel_in = input[channel];
      const channel_out = output[channel];

      for (let i = 0; i < channel_out.length; i+=1) {
        let val = channel_in[i];
        let low = parameters.low.length === 1 ? parameters.low[0] : parameters.low[i];
        let high = parameters.high.length === 1 ? parameters.high[0] : parameters.high[i];

        channel_out[i] = Math.min(Math.max(low, val), high);
      }
    }

    return true;
  }
}

registerProcessor('white-noise-processor', WhiteNoiseProcessor);
registerProcessor('one-pole-lowpass', OnePoleProcessor);
registerProcessor('one-pole-highpass', OnePoleHighpassProcessor);
registerProcessor('clip', ClipProcessor);
