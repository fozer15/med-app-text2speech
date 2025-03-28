import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import { text } from 'stream/consumers';
import util from 'util';

// Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'text-to-speech-454804-2f72607dd36e.json';

const client = new textToSpeech.TextToSpeechClient();

// Define the SSML input and output file
const sp = "<speak> Hello there. <break time='20s'/> How are you today? </speak>"
const outputFile = 'meditation_output.mp3';

// Name: en-US-Chirp3-HD-Aoede, Language Codes: en-US, SSML Gender: FEMALE
// Name: en-US-Chirp3-HD-Charon, Language Codes: en-US, SSML Gender: MALE
// Name: en-US-Chirp3-HD-Fenrir, Language Codes: en-US, SSML Gender: MALE
// Name: en-US-Chirp3-HD-Kore, Language Codes: en-US, SSML Gender: FEMALE
// Name: en-US-Chirp3-HD-Leda, Language Codes: en-US, SSML Gender: FEMALE
// Name: en-US-Chirp3-HD-Orus, Language Codes: en-US, SSML Gender: MALE
// Name: en-US-Chirp3-HD-Puck, Language Codes: en-US, SSML Gender: MALE
// Name: en-US-Chirp3-HD-Zephyr, Language Codes: en-US, SSML Gender: FEMALE

const request = {
  input: { ssml: sp },
  voice: { languageCode: 'en-US', name: 'en-US-News-K' }, // Use a WaveNet voice
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