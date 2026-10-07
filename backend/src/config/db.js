import {neon} from '@neondatabase/serverless';
import "dotenv/config";

// Create a SQL connection using our DB URL
export const sql = neon(process.env.DATABASE_URL);

export async function connectDB() {
    try {
        await sql`CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(255) NOT NULL,
        created_at DATE NOT NULL DEFAULT CURRENT_DATE
        )`

        await sql`CREATE TABLE IF NOT EXISTS plaid_connections (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        item_id VARCHAR(255) NOT NULL UNIQUE,
        institution_name VARCHAR(255),
        cursor TEXT,
        created_at TIMESTAMP DEFAULT NOW()
        )`

        await sql`CREATE TABLE IF NOT EXISTS plaid_pending_transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        plaid_transaction_id VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(255) NOT NULL DEFAULT 'Other',
        transaction_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
        )`

        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1); // Exit the process with failure, 0 means success
    }
}