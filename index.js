
window.addEventListener("load", setup);

async function setup() {
  const audio = new AudioContext();
  await audio.audioWorklet.addModule("worklets.js");

  // Setup noise node
  let flame = createFlameNode(audio);

  let output_gain = audio.createGain();
  output_gain.gain.value = 0.103 * 0.103;

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
  makeAnalyser("Hissing", audio, flame.hissing_gain);
  makeAnalyser("Lapping", audio, flame.lapping_gain);
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

  const analyser = audio.createAnalyser();
  node.connect(analyser);

  analyser.fftSize = 512;
  const buffer_len = analyser.frequencyBinCount;
  const data_array = new Uint8Array(buffer_len);

  // Initial canvas clear
  ctx.fillStyle = `rgb(0, 0, 0)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  const draw = () => {
    // Render Frequency data
    //const x = Math.floor(audio.currentTime * 10) % canvas.width;
    analyser.getByteFrequencyData(data_array);

    ctx.fillStyle = `rgb(200, 50, 50)`;
    ctx.fillRect(x + 1, 0, 1, canvas.height);

    for (let i = 0; i < buffer_len; i += 1) {
      const value = data_array[i];

      ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;

      // Render with the highest frequency at the top
      ctx.fillRect(x, canvas.height - i - 1, 1, 1);
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
    hip: new AudioWorkletNode(audio, 'one-pole-highpass', { parameterData: { frequency: 1000 } }),

    lop: new AudioWorkletNode(audio, 'one-pole-lowpass', { parameterData: { frequency: 1 } }),
    preamp: new GainNode(audio, { gain: 10 }),
    squared: audio.createGain(),
    to_the_fourth_power: audio.createGain(),
    makeup: new GainNode(audio, { gain: 600.0 }),

    output: audio.createGain(),
  };

  // Connect nodes
  noise.connect(nodes.hip)
    .connect(nodes.output);

  noise.connect(nodes.lop)
    .connect(nodes.preamp)
    .connect(nodes.squared)
    .connect(nodes.to_the_fourth_power)
    .connect(nodes.makeup)
    .connect(nodes.output.gain);

  nodes.preamp.connect(nodes.squared.gain);
  nodes.squared.connect(nodes.to_the_fourth_power.gain);

  return nodes;
}

function createLappingNode(audio, noise) {
  const bp_gain = new GainNode(audio, { gain: 100 });

  const bp_lo = new AudioWorkletNode(audio, 'one-pole-lowpass', { parameterData: { frequency: 35 }});
  const bp_hi = new AudioWorkletNode(audio, 'one-pole-highpass', { parameterData: { frequency: 25 }});

  const output = noise
    .connect(bp_lo)
    .connect(bp_hi)
    .connect(bp_gain)
    .connect(new AudioWorkletNode(audio, 'one-pole-highpass', { parameterData: {frequency: 25} }))
    .connect(new WaveShaperNode(audio, { curve: Float32Array.from([-0.9, 0.9]) }))
    .connect(new AudioWorkletNode(audio, 'one-pole-highpass', { parameterData: {frequency: 25} }))
    .connect(new GainNode(audio, { gain: 0.6 }));

  return { bp_lo, bp_hi, bp_gain, output };
}
