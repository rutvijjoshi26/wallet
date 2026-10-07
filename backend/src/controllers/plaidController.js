import { plaidClient } from '../config/plaid.js';
import { sql } from '../config/db.js';
import { CountryCode, Products } from 'plaid';

// Map Plaid's category array to our app's categories
function mapCategory(plaidCategories) {
    if (!plaidCategories?.length) return 'Other';
    const top = (plaidCategories[0] || '').toLowerCase();
    const sub = (plaidCategories[1] || '').toLowerCase();
    if (top.includes('food') || sub.includes('restaurant') || sub.includes('coffee') || sub.includes('bar')) return 'Food & Drinks';
    if (top.includes('shops') || sub.includes('shop') || sub.includes('retail') || sub.includes('clothing')) return 'Shopping';
    if (top.includes('travel') || sub.includes('taxi') || sub.includes('uber') || sub.includes('transit') || sub.includes('airline')) return 'Transportation';
    if (top.includes('recreation') || sub.includes('entertain') || sub.includes('movie') || sub.includes('gym') || sub.includes('sport')) return 'Entertainment';
    if (top.includes('service') || top.includes('bank') || sub.includes('utilities') || sub.includes('bill') || sub.includes('phone')) return 'Bills';
    return 'Other';
}

export async function createLinkToken(req, res) {
    try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });

        const response = await plaidClient.linkTokenCreate({
            user: { client_user_id: user_id },
            client_name: 'Wallet',
            products: [Products.Transactions],
            country_codes: [CountryCode.Us],
            language: 'en',
        });

        res.json({ link_token: response.data.link_token });
    } catch (error) {
        console.error('Error creating link token:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create link token' });
    }
}

export async function exchangePublicToken(req, res) {
    try {
        const { public_token, user_id, institution_name } = req.body;
        if (!public_token || !user_id) return res.status(400).json({ error: 'public_token and user_id are required' });

        const response = await plaidClient.itemPublicTokenExchange({ public_token });
        const { access_token, item_id } = response.data;

        // Upsert: update token if item already connected, otherwise insert
        const existing = await sql`SELECT id FROM plaid_connections WHERE item_id = ${item_id}`;
        if (existing.length > 0) {
            await sql`UPDATE plaid_connections SET access_token = ${access_token}, institution_name = ${institution_name || null}, cursor = NULL WHERE item_id = ${item_id}`;
        } else {
            await sql`INSERT INTO plaid_connections (user_id, access_token, item_id, institution_name) VALUES (${user_id}, ${access_token}, ${item_id}, ${institution_name || null})`;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error exchanging token:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to connect account' });
    }
}

export async function getConnectedAccounts(req, res) {
    try {
        const { userId } = req.params;
        const accounts = await sql`
            SELECT id, institution_name, created_at FROM plaid_connections WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function syncTransactions(req, res) {
    try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });

        const connections = await sql`SELECT * FROM plaid_connections WHERE user_id = ${user_id}`;
        if (connections.length === 0) return res.status(404).json({ error: 'No connected accounts' });

        for (const connection of connections) {
            let cursor = connection.cursor || undefined;
            let hasMore = true;

            while (hasMore) {
                const response = await plaidClient.transactionsSync({
                    access_token: connection.access_token,
                    ...(cursor && { cursor }),
                });
                const { added, next_cursor, has_more } = response.data;

                // Only import expenses: Plaid amount > 0 means money leaving the account
                const expenses = added.filter(t => t.amount > 0);

                for (const t of expenses) {
                    const title = t.merchant_name || t.name || 'Unknown';
                    const amount = -(t.amount); // negate: our app uses negative for expenses
                    const category = mapCategory(t.category);

                    // ON CONFLICT skips duplicates (already-pending or re-synced items)
                    await sql`
                        INSERT INTO plaid_pending_transactions (user_id, plaid_transaction_id, title, amount, category, transaction_date)
                        VALUES (${user_id}, ${t.transaction_id}, ${title}, ${amount}, ${category}, ${t.date})
                        ON CONFLICT (plaid_transaction_id) DO NOTHING
                    `;
                }

                cursor = next_cursor;
                hasMore = has_more;
            }

            await sql`UPDATE plaid_connections SET cursor = ${cursor} WHERE id = ${connection.id}`;
        }

        const pending = await sql`SELECT * FROM plaid_pending_transactions WHERE user_id = ${user_id} ORDER BY transaction_date DESC`;
        res.json({ pending });
    } catch (error) {
        console.error('Error syncing transactions:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to sync transactions' });
    }
}

export async function getPendingTransactions(req, res) {
    try {
        const { userId } = req.params;
        const pending = await sql`
            SELECT * FROM plaid_pending_transactions WHERE user_id = ${userId} ORDER BY transaction_date DESC
        `;
        res.json(pending);
    } catch (error) {
        console.error('Error fetching pending:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function updatePendingTransaction(req, res) {
    try {
        const { id } = req.params;
        const { title, category, user_id } = req.body;
        if (!title || !category || !user_id) return res.status(400).json({ error: 'Missing fields' });

        const result = await sql`
            UPDATE plaid_pending_transactions SET title = ${title}, category = ${category}
            WHERE id = ${id} AND user_id = ${user_id} RETURNING *
        `;
        if (result.length === 0) return res.status(404).json({ error: 'Not found or not authorized' });
        res.json(result[0]);
    } catch (error) {
        console.error('Error updating pending:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function confirmTransaction(req, res) {
    try {
        const { id } = req.params;
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });

        const pending = await sql`SELECT * FROM plaid_pending_transactions WHERE id = ${id} AND user_id = ${user_id}`;
        if (pending.length === 0) return res.status(404).json({ error: 'Not found or not authorized' });

        const t = pending[0];
        await sql`
            INSERT INTO transactions (title, amount, category, user_id, created_at)
            VALUES (${t.title}, ${t.amount}, ${t.category}, ${t.user_id}, ${t.transaction_date})
        `;
        await sql`DELETE FROM plaid_pending_transactions WHERE id = ${id}`;

        res.json({ success: true });
    } catch (error) {
        console.error('Error confirming transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function discardTransaction(req, res) {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        const result = await sql`DELETE FROM plaid_pending_transactions WHERE id = ${id} AND user_id = ${user_id} RETURNING id`;
        if (result.length === 0) return res.status(404).json({ error: 'Not found or not authorized' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error discarding transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
