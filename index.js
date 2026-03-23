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
        
        // Check mailbox status
        const status = await client.status('INBOX', { messages: true, unseen: true });
        console.log('INBOX Status:', status);

        // List all mailboxes for debugging
        const mailboxes = await client.list();
        console.log('Available Mailboxes:', mailboxes.map(m => m.path).join(', '));

        let lock = await client.getMailboxLock('INBOX');
        console.log('Mailbox lock acquired');
        try {
            const emails = [];
            console.log(`Starting fetch (Total messages in INBOX: ${status.messages})`);
            
            if (status.messages > 0) {
                // Fetch last 50 or total if less than 50
                const fetchRange = status.messages > 50 ? `${status.messages - 49}:${status.messages}` : `1:${status.messages}`;
                console.log('Fetching range:', fetchRange);
                
                for await (let message of client.fetch(fetchRange, { envelope: true, source: true })) {
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
app.get('/api/emails/clear', async (req, res) => {
    console.log('GET /api/emails/clear requested');
    let client;
    try {
        client = await getImapClient();
        await client.mailboxOpen('INBOX');
        console.log('Mailbox opened for clearing');
        
        // Mark all messages as deleted
        await client.messageFlagsAdd({ all: true }, ['\\Deleted']);
        
        // Explicitly close with expunge
        await client.mailboxClose(); 
        console.log('Inbox marked for deletion and closed');
        
        res.json({ success: true, message: 'Inbox marked for deletion.' });
    } catch (err) {
        console.error('Clear error:', err);
        res.status(500).json({ error: 'Clear Error: ' + err.message });
    } finally {
        if (client) await client.logout();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bridge server running on port ${PORT}`);
});
