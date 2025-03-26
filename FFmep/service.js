import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
 

const speechFile = './speech.mp3';
const noiseFile = './noise.wav';
const outputFile = './output.mp3';

ffmpeg()
  .input(speechFile)
  .input(noiseFile)
  .complexFilter('[0][1]amix=inputs=2:duration=longest')
  .output(outputFile)
  .on('end', () => {
    console.log('Mixing completed');
  })
  .on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('ffmpeg binary not found. Please ensure the correct path is set.');
    } else {
      console.error('Error: ', err);
    }
  })
  .run();