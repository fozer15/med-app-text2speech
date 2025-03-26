import OpenAI from "openai";
import fs from "fs";
import readline from "readline";
import csv from "csv-parser"
const client = new OpenAI({
    apiKey: "",
});

async function createFineTuneJob() {
    const fileStream = fs.createReadStream("./training_data/training_data2.json");
    const file = await client.files.create({
        file: fileStream,
        purpose: "fine-tune"
    });
    await client.fineTunes.create({
        training_file: file.id,
        model: "ft:gpt-4o-mini-2024-07-18:personal::BF71qtEo"
    });
}

async function main() {
  
    let conversationHistory = [];

    async function getResponse(newMessage) {
        conversationHistory.push(newMessage);

        const completion = await client.chat.completions.create({
            messages: conversationHistory,
            model: "ft:gpt-4o-mini-2024-07-18:personal::BF71qtEo",
            store: true,
        });

        const responseMessage = completion.choices[0].message;
        conversationHistory.push({role:responseMessage.role,content:responseMessage.content});

        console.log(`AI: ${responseMessage.content}`);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function promptUser() {
        rl.question("You: ", async (input) => {
            await getResponse({ role: "user", content: input });
            promptUser(); 
        });
    }

    promptUser();
}

//createFineTuneJob(); train the model
main(); // use the model

function convertToOpenAIFormat(rows) {
    const conversations = {}; // Store conversations by ID
    const openAIFormatted = [];

    rows.forEach(row => {
        let { conv_id, utterance_idx, context, prompt, speaker_idx, utterance } = row;

        // Clean up conv_id (removing 'hit:0_')
        conv_id = conv_id.replace(/^hit:\d+_/, ""); 

        // Clean up _comma_ artifacts
        prompt = prompt.replace(/_comma_/g, ",");
        utterance = utterance ? utterance.replace(/_comma_/g, ",") : "";

        // Group conversation data
        if (!conversations[conv_id]) {
            conversations[conv_id] = {
                context,
                prompt,
                messages: []
            };
        }

        // Add message
        conversations[conv_id].messages.push({
            role: speaker_idx === "0" ? "user" : "assistant",
            content: utterance
        });
    });

    // Convert to OpenAI format
    Object.values(conversations).forEach(conv => {
        openAIFormatted.push({
            messages: [
                { role: "system", content: `This is a conversation about ${conv.context}.` },
                { role: "user", content: conv.prompt },
                ...conv.messages
            ]
        });
    });

    return openAIFormatted;
}

// Read CSV and Convert
function processCSV(inputFile, outputFile) {
    const rows = [];

    fs.createReadStream(inputFile)
        .pipe(csv())
        .on("data", row => rows.push(row))
        .on("end", () => {
            const jsonData = convertToOpenAIFormat(rows);
            fs.writeFileSync(outputFile, jsonData.map(entry => JSON.stringify(entry)).join("\n"), "utf-8");
            console.log(`✅ Conversion complete! Output saved to ${outputFile}`);
        });
}

// Run conversion
const inputCsvFile = "./data-sets/empatheticdialogues/valid.csv";  // Change this to your CSV file
const outputJsonFile = "output3.jsonl"; // OpenAI format (JSONL)
//processCSV(inputCsvFile, outputJsonFile);