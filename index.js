
window.addEventListener("load", setup);

async function setup() {
  const audio = new AudioContext();
  await audio.audioWorklet.addModule("worklets.js");

  // Setup noise node
  let flame = createFlameNode(audio);

  let output_gain = audio.createGain();
  output_gain.gain.value = 0.0001;

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

  makeSlider("Gain", output_gain.gain, { min: 0.0001, max: 0.5, step: 0.0001});
}

function makeSlider(name, param, options) {
  const div = document.createElement("div");
  const slider = document.createElement("input");
  const display = document.createElement("input");

  slider.type = "range";
  slider.min = options.min ? options.min : 0.0;
  slider.max = options.max ? options.max : 1.0;
  slider.step = options.step ? options.step : 0.001;
  slider.value = param.value;
  slider.addEventListener('input', () => {
    param.value = slider.value;
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

function createFlameNode(audio) {
  // Create nodes that will make up our flame
  let noise = new AudioWorkletNode(audio, 'white-noise-processor');

  let hissing = createHissingNode(audio, noise);
  let hissing_gain = audio.createGain();

  let output = audio.createGain();

  // Connect nodes
  hissing.output.connect(hissing_gain)
  hissing_gain.connect(output);

  // Set values of nodes
  hissing_gain.gain.value = 0.001;

  return {
    hissing: hissing,
    hissing_gain: hissing_gain,
    output: output
  };
}

function createHissingNode(audio, noise) {
  // Create nodes that will make up `Hissing`
  let nodes = {
    hip: new AudioWorkletNode(audio, 'one-pole-highpass'),

    lop: new AudioWorkletNode(audio, 'one-pole-lowpass'),
    preamp: audio.createGain(),
    squared: audio.createGain(),
    to_the_fourth_power: audio.createGain(),
    makeup: audio.createGain(),

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

  // Set values of nodes
  nodes.hip.parameters['frequency'] = 1000;
  nodes.lop.parameters['frequency'] = 1;
  nodes.preamp.gain.value = 10.0;
  nodes.makeup.gain.value = 600.0;

  return nodes;
}

