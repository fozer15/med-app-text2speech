import { Speechify } from "@speechify/api-sdk";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url"; // Import fileURLToPath to define __dirname
import { Readable } from "stream"; // Native Node.js module
import express from "express";
import dotenv from "dotenv"; // Import dotenv
import ffmpeg from "fluent-ffmpeg"; // Import ffmpeg
import fs from "fs";
import db from "./db.js";
import { authMiddleware } from "./authMiddleware.js"; // Import authMiddleware
import bodyParser from "body-parser"; // Import body-parser

dotenv.config();

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const speechify = new Speechify({
    apiKey: process.env.SPEECHIFY_API_KEY, // Load API key from environment variables
});

async function getMeditations() {
    const filePath = path.join(__dirname, "ssml_meditations.json");
    try {
        const data = await readFile(filePath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading the ssml_meditations.json file:", error);
        throw error;
    }
}

async function listVoices() {
    try {
        console.log("Fetching available voices from Speechify API...");
        const voices = await speechify.voicesList();
        console.log("Available voices:", voices);
        return voices;
    } catch (error) {
        console.error("Error fetching voices from Speechify API:", error);
        throw error;
    }
}

async function generateAudio(title, ambiance, voiceId) {
    try {
        const meditations = await getMeditations();
        if (!meditations || meditations.length === 0) {
            throw new Error("No meditations found in the JSON file.");
        }

        const meditation = meditations.find((m) => m.title.toLowerCase() === title.toLowerCase());
        if (!meditation) {
            throw new Error(`Meditation with title "${title}" not found.`);
        }

        const { ssml: inputSSML } = meditation;
        const audioFormat = "mp3";

        console.log(`${inputSSML}`);

        const responseStream = await speechify.audioStream({
            input: inputSSML,
            voiceId, // Use the provided voiceId
            audioFormat,
        });

        const nodeStream = Readable.fromWeb(responseStream);
        const outputFileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp3`;
        const writeStream = createWriteStream(outputFileName);

        await new Promise((resolve, reject) => {
            nodeStream.pipe(writeStream);

            nodeStream.on("end", () => {
                console.log(`Audio file saved successfully as ${outputFileName}.`);
                resolve();
            });

            nodeStream.on("error", (error) => {
                console.error("Error streaming audio:", error);
                reject(error);
            });
        });

        // Mix with ambiance
        const ambianceFilePath = path.join(__dirname, "ambiances", `${ambiance}.mp3`);
        const mixedOutputFileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_with_${ambiance}.mp3`;

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(outputFileName)
                .input(ambianceFilePath)
                .inputOptions("-stream_loop -1") // Loop the ambiance sound indefinitely
                .complexFilter([
                    "[0:a]volume=1.8[a0]", // Increase speech volume slightly
                    "[1:a]asetrate=48000,aresample=48000,volume=0.15[a1]", // Use higher sample rate for ambiance and increase volume slightly
                    "[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]" // Match ambiance duration to speech
                ])
                .outputOptions([
                    "-map [a]",
                    "-ar 48000", // Set output sample rate to 48 kHz for higher quality
                    "-b:a 192k" // Set audio bitrate to 192 kbps for better quality
                ])
                .save(mixedOutputFileName)
                .on("end", () => {
                    console.log(`Mixed audio file saved successfully as ${mixedOutputFileName}.`);
                    resolve(mixedOutputFileName);
                })
                .on("error", (error) => {
                    console.error("Error mixing audio:", error);
                    reject(error);
                });
        });
    } catch (error) {
        console.error("Error generating audio:", error.message);
        throw error;
    }
}

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); // Add body-parser middleware for URL-encoded data
app.use(bodyParser.json()); // Add body-parser middleware for JSON data

app.post("/generate-audio", authMiddleware, async (req, res) => {

    const { title, ambiance, voiceId } = req.body;

    if (!title || !ambiance || !voiceId) {
        return res.status(400).json({ error: "Title, ambiance, and voiceId are required." });
    }

    try {
        console.log(`Received request to generate audio for title: ${title}, ambiance: ${ambiance}, voiceId: ${voiceId}`);
        const outputFileName = await generateAudio(title, ambiance, voiceId); // Pass voiceId to generateAudio
        const filePath = path.join(__dirname, outputFileName);

        res.setHeader("Content-Type", "audio/mpeg"); // Set the appropriate content type for MP3
        res.setHeader("Content-Disposition", `attachment; filename="${outputFileName}"`); // Suggest a filename
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).json({ error: "Failed to send the audio file." });
            } else {
                console.log(`Audio file sent successfully: ${filePath}`);
            }
        });
    } catch (error) {
        console.error("Error in /generate-audio endpoint:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.get("/list-voices", authMiddleware, async (req, res) => {
    try {
        const voices = await listVoices();
        const categorizedVoices = {};

        voices
            .filter((voice) => 
                voice.models && 
                voice.models.some((model) => model.languages.some((lang) => lang.locale === "en-US")) && 
                voice.tags.length > 0 // Check for en-US in languages and non-empty tags
            )
            .forEach((voice) => {
                const genderKey = voice.gender || "unknown"; // Use "unknown" if gender is undefined
                if (!categorizedVoices[genderKey]) {
                    categorizedVoices[genderKey] = [];
                }
                categorizedVoices[genderKey].push({
                    id: voice.id,
                    displayName: voice.displayName,
                    tags: voice.tags,
                });
            });

        res.status(200).json({ categorizedVoices });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch voices." });
    }
});

app.get("/meditation-titles", authMiddleware, async (req, res) => {
    try {
        const meditations = await getMeditations();
        const titles = meditations.map((meditation) => meditation.title); // Extract titles
        res.status(200).json({ titles });
    } catch (error) {
        console.error("Error fetching meditation titles:", error);
        res.status(500).json({ error: "Failed to fetch meditation titles." });
    }
});

const AMBIANCES_FOLDER = path.join(__dirname, 'ambiances');

app.get('/ambiances', authMiddleware, (req, res) => {
    fs.readdir(AMBIANCES_FOLDER, (err, files) => {
      if (err) {
        console.error('Error reading ambiances folder:', err);
        return res.status(500).json({ error: 'Could not read ambiances folder' });
      }
  
      const mp3Names = files
        .filter(file => path.extname(file).toLowerCase() === '.mp3')
        .map(file => path.basename(file, '.mp3'));
  
      res.json(mp3Names);
    });
});

app.listen(3000, '0.0.0.0', () => {
    console.log('✅ Server is running on all interfaces at port 3000');
  });