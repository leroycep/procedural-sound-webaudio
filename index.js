
window.addEventListener("load", async () => {
  const audio = new AudioContext();
  await audio.audioWorklet.addModule("white-noise-processor.js");

  // Setup noise node
  let flame = createFlameNode(audio);

  let output_gain = audio.createGain();
  output_gain.gain.value = 0.0;

  flame.connect(output_gain).connect(audio.destination);

  const play_button = document.querySelector("#play");
  play_button.addEventListener("click", () => {
    if (audio.state === 'suspended') {
      audio.resume();
    }

    output_gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.1);
  });

  const mute_button = document.querySelector("#mute");
  mute_button.addEventListener("click", () => {
    output_gain.gain.setValueAtTime(0, audio.currentTime);
  });
});

function createFlameNode(audio) {
  // Create nodes that will make up our flame
  let noise = new AudioWorkletNode(audio, 'white-noise-processor');

  let hissing = createHissingNode(audio, noise);
  let hissing_gain = audio.createGain();

  let output = audio.createGain();

  // Connect nodes
  hissing
    .connect(hissing_gain)
    .connect(output);
  
  // Set values of nodes
  hissing_gain.gain = 0.2;

  return output;
}

function createHissingNode(audio, noise) {
  // Create nodes that will make up `Hissing`
  let hip = audio.createBiquadFilter();

  let lop = audio.createBiquadFilter();
  let gainX10 = audio.createGain();
  let squared = audio.createGain();
  let to_the_fourth_power = audio.createGain();
  let gainX600 = audio.createGain();

  let output = audio.createGain();

  // Connect nodes
  noise
    .connect(hip)
    .connect(output);
  
  noise
    .connect(lop)
    .connect(gainX10)
    .connect(squared)
    .connect(to_the_fourth_power)
    .connect(gainX600)
    .connect(output.gain);

  gainX10.connect(squared.gain);
  squared.connect(to_the_fourth_power.gain);

  // Set values of nodes
  hip.type = "highpass";
  hip.frequency.value = 1000;
  
  lop.type = "lowpass";
  lop.frequency.value = 1;
  
  gainX10.gain.value = 10.0;
  gainX600.gain.value = 600.0;
  
  return output;
}
