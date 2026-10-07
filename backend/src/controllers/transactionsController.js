import { sql } from "../config/db.js";

export async function getTransactionsByUserId(req, res) {

    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const transactions = await sql`
        SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createTransaction(req, res) {
    try {
        const { title, amount, category, user_id, transaction_date } = req.body;

        if (!title || amount === undefined || !category || !user_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Use provided date or default to current date
        const date = transaction_date ? new Date(transaction_date) : new Date();

        const transaction = await sql`
        INSERT INTO transactions (title, amount, category, user_id, created_at) 
        VALUES (${title}, ${amount}, ${category}, ${user_id}, ${date}) 
        RETURNING *
        `;

        res.status(201).json(transaction[0]);
    } catch (error) {
        console.error("Error creating transaction:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteTransactionById(req, res) {
    try {
        const transactionId = req.params.id;
        const { user_id } = req.body;

        if (isNaN(parseInt(transactionId))) {
            return res.status(400).json({ error: "Invalid Transaction ID" });
        }

        // Security: Only delete if transaction belongs to the requesting user
        const result = await sql`
        DELETE FROM transactions WHERE id = ${transactionId} AND user_id = ${user_id} RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: "Transaction not found or not authorized" });
        }

        res.status(200).json({ message: "Transaction deleted successfully" });
    } catch (error) {
        console.error("Error deleting transaction:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateTransaction(req, res) {
    try {
        const transactionId = req.params.id;
        const { title, amount, category, user_id, transaction_date } = req.body;

        if (isNaN(parseInt(transactionId))) {
            return res.status(400).json({ error: "Invalid Transaction ID" });
        }

        if (!title || amount === undefined || !category || !user_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const date = transaction_date ? new Date(transaction_date) : null;

        // Build update query - only update date if provided
        let result;
        if (date) {
            result = await sql`
                UPDATE transactions 
                SET title = ${title}, amount = ${amount}, category = ${category}, created_at = ${date}
                WHERE id = ${transactionId} AND user_id = ${user_id}
                RETURNING *
            `;
        } else {
            result = await sql`
                UPDATE transactions 
                SET title = ${title}, amount = ${amount}, category = ${category}
                WHERE id = ${transactionId} AND user_id = ${user_id}
                RETURNING *
            `;
        }

        if (result.length === 0) {
            return res.status(404).json({ error: "Transaction not found or not authorized" });
        }

        res.status(200).json(result[0]);
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getTransactionSummaryByUserId(req, res) {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const balanceResult = await sql`
        SELECT COALESCE(SUM(amount), 0) AS balance FROM transactions WHERE user_id = ${userId}
        `;

        const incomeResult = await sql`
        SELECT COALESCE(SUM(amount), 0) AS income FROM transactions 
        WHERE user_id = ${userId} AND amount > 0
        `;

        const expenseResult = await sql`
        SELECT COALESCE(SUM(amount), 0) AS expense FROM transactions 
        WHERE user_id = ${userId} AND amount < 0
        `;

        res.status(200).json(
            {
                balance: balanceResult[0].balance,
                income: incomeResult[0].income,
                expense: expenseResult[0].expense
            }
        );
    } catch (error) {
        console.error("Error fetching summary:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getTransactionsByMonth(req, res) {
    try {
        const { userId, year, month } = req.params;

        if (!userId || !year || !month) {
            return res.status(400).json({ error: "User ID, year, and month are required" });
        }

        // Validate year and month
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ error: "Invalid year or month" });
        }

        // Get transactions for the specified month
        const transactions = await sql`
            SELECT * FROM transactions 
            WHERE user_id = ${userId} 
            AND EXTRACT(YEAR FROM created_at) = ${yearNum}
            AND EXTRACT(MONTH FROM created_at) = ${monthNum}
            ORDER BY created_at DESC
        `;

        // Get monthly summary
        const incomeResult = await sql`
            SELECT COALESCE(SUM(amount), 0) AS income FROM transactions 
            WHERE user_id = ${userId} 
            AND EXTRACT(YEAR FROM created_at) = ${yearNum}
            AND EXTRACT(MONTH FROM created_at) = ${monthNum}
            AND amount > 0
        `;

        const expenseResult = await sql`
            SELECT COALESCE(SUM(amount), 0) AS expense FROM transactions 
            WHERE user_id = ${userId} 
            AND EXTRACT(YEAR FROM created_at) = ${yearNum}
            AND EXTRACT(MONTH FROM created_at) = ${monthNum}
            AND amount < 0
        `;

        const balance = parseFloat(incomeResult[0].income) + parseFloat(expenseResult[0].expense);

        res.status(200).json({
            transactions,
            summary: {
                income: incomeResult[0].income,
                expense: expenseResult[0].expense,
                balance: balance.toFixed(2)
            },
            month: monthNum,
            year: yearNum
        });
    } catch (error) {
        console.error("Error fetching monthly transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}