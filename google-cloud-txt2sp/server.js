import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import { text } from 'stream/consumers';
import util from 'util';

// Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'text-to-speech-454804-2f72607dd36e.json';

const client = new textToSpeech.TextToSpeechClient();

// Define the SSML input and output file
const sp = 'Relax your body and mind. Let go of all your worries.';
const outputFile = 'meditation_output.mp3';

const request = {
  input: { text: sp },
  voice: { languageCode: 'en-US', name: 'en-US-Chirp-HD-D' }, // Use a WaveNet voice
  audioConfig: { audioEncoding: 'MP3' },
};

async function synthesizeSpeech(effect) {
  try {
    const effectsProfileId = {
      calm: 'telephony-class-application',
      angry: 'wearable-class-device',
      relaxed: 'handset-class-device'
    };

    const modifiedRequest = {
      ...request,
      audioConfig: {
        ...request.audioConfig,
        effectsProfileId: [effectsProfileId[effect]],
        speakingRate: effect === 'calm' ? 0.82 : effect === 'angry' ? 1.2 : 1.0
      }
    };

    const [response] = await client.synthesizeSpeech(modifiedRequest);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(outputFile, response.audioContent, 'binary');
    console.log(`Audio content written to file: ${outputFile}`);
  } catch (error) {
    console.error('Error generating speech:', error);
  }
}

// Function to list all available voices and write to a file
async function listVoices() {
  try {
    const [result] = await client.listVoices({});
    const voices = result.voices;
    console.log('Available voices:');
    const voiceDetails = voices.map(voice => 
      `Name: ${voice.name}, Language Codes: ${voice.languageCodes.join(', ')}, SSML Gender: ${voice.ssmlGender}`
    ).join('\n');
    
    const writeFile = util.promisify(fs.writeFile);
    await writeFile('available_voices.txt', voiceDetails);
    console.log('Voice information written to file: available_voices.txt');
  } catch (error) {
    console.error('Error listing voices:', error);
  }
}

// Call the function with the "calm" effect for meditation
synthesizeSpeech('calm');

// List all available voices and write to a file
listVoices();