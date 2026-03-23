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
    const client = new ImapFlow(config);
    await client.connect();
    return client;
}

// Generic email bridge
app.get('/api/emails', async (req, res) => {
    const client = await getImapClient();
    try {
        let lock = await client.getMailboxLock('INBOX');
        try {
            const emails = [];
            // Fetch last 50 messages for client-side filtering
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
            res.json(emails.reverse());
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
