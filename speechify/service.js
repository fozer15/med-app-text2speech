import { Speechify } from "@speechify/api-sdk";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream"; // Native Node.js module
import express from "express";
import dotenv from "dotenv"; // Import dotenv

dotenv.config(); // Load environment variables from .env file

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

async function generateAudio(title) {
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
        const voiceId = "kristy";
        const audioFormat = "mp3";

        console.log(`Generating audio for meditation: ${title}`);

        const responseStream = await speechify.audioStream({
            input: inputSSML,
            voiceId,
            audioFormat,
        });

        const nodeStream = Readable.fromWeb(responseStream);
        const outputFileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp3`;
        const writeStream = createWriteStream(outputFileName);

        return new Promise((resolve, reject) => {
            nodeStream.pipe(writeStream);

            nodeStream.on("end", () => {
                console.log(`Audio file saved successfully as ${outputFileName}.`);
                resolve(outputFileName);
            });

            nodeStream.on("error", (error) => {
                console.error("Error streaming audio:", error);
                reject(error);
            });
        });
    } catch (error) {
        console.error("Error generating audio:", error);
        throw error;
    }
}

const app = express();
app.use(express.json());

app.post("/generate-audio", async (req, res) => {
    const { title, ambiance } = req.body;

    if (!title || !ambiance) {
        return res.status(400).json({ error: "Title and ambiance are required." });
    }

    try {
        console.log(`Received request to generate audio for title: ${title} with ambiance: ${ambiance}`);
        const outputFileName = await generateAudio(title); // Wait for the stream to finish
        res.status(200).json({ message: "Audio generated successfully.", file: outputFileName });
    } catch (error) {
        console.error("Error in /generate-audio endpoint:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
