import admin from "firebase-admin"; // Import Firebase Admin SDK
import { readFileSync } from "fs"; // Import readFileSync to read the JSON file
import path from "path"; // Import path for resolving file paths
import { fileURLToPath } from "url"; // Import fileURLToPath to define __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read service account JSON dynamically
const serviceAccountPath = path.resolve(__dirname, "./med-app-b4426-firebase-adminsdk-fbsvc-495b75defd.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount), // Use service account credentials
    });
}

// Authentication middleware
export async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Authorization token is required." });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token); // Verify Firebase token
        req.user = decodedToken; // Attach decoded token to the request object
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error("Error verifying Firebase token:", error);
        res.status(401).json({ error: "Invalid or expired token." });
    }
}
