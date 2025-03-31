
import pkg from 'pg';
import dotenv from "dotenv";
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
    user: process.env.PG_USER, // PostgreSQL username
    host: process.env.PG_HOST, // PostgreSQL host
    database: process.env.PG_DATABASE, // PostgreSQL database name
    password: process.env.PG_PASSWORD, // PostgreSQL password
    port: process.env.PG_PORT, // PostgreSQL port
});

// Test the database connection
pool.connect()
    .then(() => console.log("Connected to PostgreSQL database successfully."))
    .catch((err) => {
        console.error("Error connecting to PostgreSQL database:", err);
        process.exit(1); // Exit the process if the connection fails
    });

export default pool;