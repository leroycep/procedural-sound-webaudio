
let _audio_global = null;

async function get_audio() {
  if (_audio_global === null) {
    _audio_global = new AudioContext();
    await _audio_global.audioWorklet.addModule("worklets.js");
  }
  return _audio_global;
}

async function play_fire_sound() {
  const audio = await get_audio();

  // Setup noise node
  let flame = createFlameNode(audio);

  let output_gain = audio.createGain();
  output_gain.gain.value = 0.3;

  flame.output
    .connect(output_gain)
    .connect(audio.destination);

  const play_button = document.querySelector("#play");
  play_button.addEventListener("click", () => {
    audio.resume();
  });

  const mute_button = document.querySelector("#mute");
  mute_button.addEventListener("click", () => {
    audio.suspend();
  });

  makeSlider("Gain", (new_val) => output_gain.gain.value = (new_val * new_val), { step: 0.001, default: Math.sqrt(output_gain.gain.value) });
  makeSlider("Hissing", (new_val) => flame.hissing_gain.gain.value = new_val * new_val, { step: 0.001, default: Math.sqrt(flame.hissing_gain.gain.value) });
  makeSlider("Lapping", (new_val) => flame.lapping_gain.gain.value = new_val * new_val, { step: 0.001, default: Math.sqrt(flame.lapping_gain.gain.value) });

  makeAnalyser("Flame", audio, flame.output);
  makeAnalyser("Hissing", audio, flame.hissing.output);
  makeAnalyser("Lapping", audio, flame.lapping.output);
}

function makeSlider(name, set_value, options) {
  const div = document.createElement("div");
  const slider = document.createElement("input");
  const display = document.createElement("input");

  slider.type = "range";
  slider.min = options.min ? options.min : 0.0;
  slider.max = options.max ? options.max : 1.0;
  slider.step = options.step ? options.step : 0.001;
  slider.value = options.default;
  slider.addEventListener('input', () => {
    set_value(slider.value);
    display.value = slider.value;
  });

  display.type = "text";
  display.disabled = true;
  display.value = slider.value;

  div.innerHTML = `${name}`;
  div.appendChild(slider);
  div.appendChild(display);

  document.querySelector('#controls').appendChild(div);
}

function makeAnalyser(name, audio, node, timeDomain) {
  const div = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const analyser = node
    .connect(new AnalyserNode(audio, {
      maxDecibels: -20,
      minDecibels: -100,
      fftSize: 1024,
    }));

  const buffer_len = analyser.frequencyBinCount;
  const data_array = new Uint8Array(buffer_len);

  const MIN_FREQ = 0;
  const MAX_FREQ = 20000;
  const FREQ_RANGE = MAX_FREQ - MIN_FREQ;
  const analyser_min_freq = 0;
  const analyser_max_freq = audio.sampleRate/2;
  const analyser_range = analyser_max_freq - analyser_min_freq;

  // Initial canvas clear
  ctx.fillStyle = `rgb(0, 0, 0)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  const draw = () => {
    if (audio.state === 'suspended') {
      requestAnimationFrame(draw);
      return;
    }

    // Render Frequency data
    analyser.getByteFrequencyData(data_array);

    ctx.fillStyle = `rgb(200, 50, 50)`;
    ctx.fillRect(x + 1, 0, 1, canvas.height);

    for (let y = 0; y < canvas.height; y += 1) {
      const index = Math.floor((y / canvas.height) * MAX_FREQ / analyser_max_freq);
      const value = data_array[y];

      const PALETTE = [
        [0x00, 0x00, 0x00],
        [0x2B, 0x12, 0x00],
        [0x8D, 0x1E, 0x00],
        [0xCF, 0x5C, 0x00],
        [0xF1, 0xD2, 0x6C],
        [0xFF, 0xFF, 0xFF],
      ];
      const PALETTE_BUCKET_SIZE = 256 / (PALETTE.length - 1);
      const palette_index = Math.floor(value / PALETTE_BUCKET_SIZE);
      const c0 = PALETTE[palette_index];
      const c1 = PALETTE[palette_index + 1];

      // How far we are from the first color
      const d0 = (value % PALETTE_BUCKET_SIZE) / PALETTE_BUCKET_SIZE;

      const color = [
        c0[0] * (1 - d0) + c1[0] * d0,
        c0[1] * (1 - d0) + c1[1] * d0,
        c0[2] * (1 - d0) + c1[2] * d0,
      ];

      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

      // Render with the highest frequency at the top
      ctx.fillRect(x, canvas.height - y - 1, 1, 1);
    }

    x += 1;
    x %= canvas.width;
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  div.innerHTML = `<h4>${name}</h4>`;
  div.appendChild(canvas);

  document.querySelector('#controls').appendChild(div);
}

function createFlameNode(audio) {
  // Create nodes that will make up our flame
  let noise = new AudioWorkletNode(audio, 'white-noise-processor');

  let nodes = {
    noise: noise,

    hissing: createHissingNode(audio, noise),
    hissing_gain: audio.createGain(),

    lapping: createLappingNode(audio, noise),
    lapping_gain: audio.createGain(),

    output: audio.createGain(),
  };

  // Connect nodes
  nodes.hissing.output
    .connect(nodes.hissing_gain)
    .connect(nodes.output);

  nodes.lapping.output
    .connect(nodes.lapping_gain)
    .connect(nodes.output);

  // Set values of nodes
  nodes.hissing_gain.gain.value = 0.2;
  nodes.lapping_gain.gain.value = 0.6;

  return nodes;
}

function createHissingNode(audio, noise) {
  // Create nodes that will make up `Hissing`
  let nodes = {
    hip: new BiquadFilterNode(audio, { type: "highpass", frequency: 1000, Q: 0 }),

    lop: new AudioWorkletNode(audio, 'one-pole-lowpass', { parameterData: { frequency: 1 } }),
    preamp: new GainNode(audio, { gain: 10 }),
    squared: new AudioWorkletNode(audio, 'squared'),
    to_the_fourth_power: new AudioWorkletNode(audio, 'squared'),
    makeup: new GainNode(audio, { gain: 600.0 }),

    output: new AudioWorkletNode(audio, 'multiply', { numberOfInputs: 2 }),
  };

  // Connect nodes
  noise.connect(nodes.hip)
    .connect(nodes.output, 0, 0);

  noise.connect(nodes.lop)
    .connect(nodes.preamp)
    .connect(nodes.squared)
    .connect(nodes.to_the_fourth_power)
    .connect(nodes.makeup)
    .connect(nodes.output, 0, 1);

  return nodes;
}

function createLappingNode(audio, noise) {
  const output = noise
    .connect(new BiquadFilterNode(audio, { type: "lowpass", frequency: 30 + 5, Q: 0 }))
    .connect(new BiquadFilterNode(audio, { type: "highpass", frequency: 30 - 5, Q: 0 }))
    .connect(new GainNode(audio, { gain: 100 }))
    .connect(new BiquadFilterNode(audio, { type: "highpass", frequency: 25, Q: 0 }))
    .connect(new WaveShaperNode(audio, { curve: Float32Array.from([-0.9, 0.9]) }))
    .connect(new BiquadFilterNode(audio, { type: "highpass", frequency: 25, Q: 0 }))
    .connect(new GainNode(audio, { gain: 0.6 }));

  return { output };
}
