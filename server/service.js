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

const soundsFolder = path.join(__dirname, "sounds");
const meditationsFolder = path.join(soundsFolder, "meditations");
const voicesFolder = path.join(soundsFolder, "voices");
const ambiancesFolder = path.join(soundsFolder, "ambiances");

if (!fs.existsSync(soundsFolder)) {
    fs.mkdirSync(soundsFolder); // Ensure the sounds folder exists
}

if (!fs.existsSync(meditationsFolder)) {
    fs.mkdirSync(meditationsFolder); // Ensure the meditations folder exists
}

if (!fs.existsSync(voicesFolder)) {
    fs.mkdirSync(voicesFolder); // Ensure the voices folder exists
}

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

        const responseStream = await speechify.audioStream({
            input: inputSSML,
            voiceId,
            audioFormat,
        });

        const nodeStream = Readable.fromWeb(responseStream);
        const outputFileName = path.join(
            voicesFolder,
            `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp3`
        );
        const writeStream = createWriteStream(outputFileName);

        await new Promise((resolve, reject) => {
            nodeStream.pipe(writeStream);

            writeStream.on("finish", () => {
                console.log(`Audio file saved successfully as ${outputFileName}.`);
                resolve();
            });

            writeStream.on("error", (error) => {
                console.error("Error writing audio file:", error);
                reject(error);
            });

            nodeStream.on("error", (error) => {
                console.error("Error streaming audio:", error);
                reject(error);
            });
        });

        // Validate input files
        const ambianceFilePath = path.join(ambiancesFolder, `${ambiance}.mp3`);
        if (!fs.existsSync(outputFileName) || fs.statSync(outputFileName).size === 0) {
            throw new Error(`Generated audio file is missing or empty: ${outputFileName}`);
        }
        if (!fs.existsSync(ambianceFilePath) || fs.statSync(ambianceFilePath).size === 0) {
            throw new Error(`Ambiance file is missing or empty: ${ambianceFilePath}`);
        }

        const mixedOutputFileName = path.join(
            meditationsFolder,
            `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_with_${ambiance}_by_${voiceId}.mp3`
        );

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(outputFileName)
                .input(ambianceFilePath)
                .on("start", (commandLine) => {
                    console.log("FFmpeg command:", commandLine);
                })
                .on("error", (error) => {
                    console.error("Error mixing audio:", error);
                    reject(error);
                })
                .inputOptions("-stream_loop -1") // Loop the ambiance sound indefinitely
                .complexFilter([
                    "[0:a]atempo=0.92,volume=1.8[a0]", // Adjust tempo and volume
                    "[1:a]volume=0.34[a1]", // Adjust ambiance volume
                    "[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]" // Mix audio streams
                ])
                .outputOptions([
                    "-map [a]",
                    "-ar 48000", // Set output sample rate to 48 kHz
                    "-b:a 192k", // Set audio bitrate to 192 kbps
                    "-ac 2" // Ensure stereo output
                ])
                .save(mixedOutputFileName)
                .on("end", () => {
                    console.log(`Mixed audio file saved successfully as ${mixedOutputFileName}.`);
                    resolve(mixedOutputFileName);
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

    const outputFileName = path.join(
        meditationsFolder,
        `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_with_${ambiance}_by_${voiceId}.mp3`
    );

    const serveFile = (filePath) => {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).json({ error: "Failed to send the audio file." });
            } else {
                console.log(`Audio file sent successfully: ${filePath}`);
            }
        });
    };

    try {
        if (fs.existsSync(outputFileName)) {
            console.log(`Audio file already exists: ${outputFileName}`);
            return serveFile(outputFileName);
        }

        const generatedFileName = await generateAudio(title, ambiance, voiceId);
        serveFile(generatedFileName);
    } catch (error) {
        console.error("Error in /generate-audio endpoint:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.post("/remove-file", authMiddleware, (req, res) => {
    const { title, ambiance, voiceId } = req.body;

    if (!title || !ambiance || !voiceId) {
        return res.status(400).json({ error: "Title, ambiance, and voiceId are required." });
    }

    const fileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_with_${ambiance}_by_${voiceId}.mp3`;
    const filePath = path.join(meditationsFolder, fileName);

    fs.unlink(filePath, (err) => {
      
        if (err) {
            if (err.code === "ENOENT") { //check if mp3 exists 
                return res.status(404).json({ error: "File not found." });
            }
            console.error("Error deleting file:", err);
            return res.status(500).json({ error: "Failed to delete the file." });
        }

        console.log(`File removed successfully: ${filePath}`);
        res.status(200).json({ message: "File removed successfully." });
    });
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

app.get('/ambiances', authMiddleware, (req, res) => {
    fs.readdir(ambiancesFolder, (err, files) => {
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