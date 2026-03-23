const express = require('express');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cors = require('cors');
require('dotenv').config();

const app = express();
// Open CORS to all origins
app.use(cors({ origin: '*' }));
app.use(express.json());

const config = {
    host: process.env.IMAP_HOST || 'mail.spacemail.com',
    port: parseInt(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: false
};

async function getImapClient() {
    console.log('Connecting to IMAP:', config.host, config.port);
    const client = new ImapFlow(config);
    try {
        await client.connect();
        console.log('IMAP Connected successfully');
        return client;
    } catch (err) {
        console.error('IMAP Connection Failed:', err.message);
        throw err;
    }
}

// Generic email bridge
app.get('/api/emails', async (req, res) => {
    console.log('GET /api/emails requested');
    let client;
    try {
        client = await getImapClient();
        let lock = await client.getMailboxLock('INBOX');
        console.log('Mailbox lock acquired');
        try {
            const emails = [];
            console.log('Fetching messages...');
            for await (let message of client.fetch({ last: 50 }, { envelope: true, source: true })) {
                const parsed = await simpleParser(message.source);
                emails.push({
                    uid: message.uid,
                    subject: parsed.subject,
                    from: parsed.from.text,
                    date: parsed.date,
                    text: parsed.text,
                    html: parsed.textAsHtml
                });
            }
            console.log(`Fetched ${emails.length} messages`);
            res.json(emails.reverse());
        } finally {
            lock.release();
            console.log('Mailbox lock released');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        res.status(500).json({ error: 'IMAP Error: ' + err.message, stack: err.stack });
    } finally {
        if (client) await client.logout();
    }
});

// Clear inbox bridge
app.delete('/api/emails/clear', async (req, res) => {
    const client = await getImapClient();
    try {
        let lock = await client.getMailboxLock('INBOX');
        try {
            await client.messageFlagsAdd({ all: true }, ['\\Deleted']);
            res.json({ success: true, message: 'Inbox cleared.' });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        await client.logout();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bridge server running on port ${PORT}`);
});
