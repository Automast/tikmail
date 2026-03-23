const emailList = document.getElementById('email-list');
const findTikTokBtn = document.getElementById('find-tiktok-btn');
const tiktokCodeInput = document.getElementById('tiktok-code-input');
const copyBtn = document.getElementById('copy-btn');
const tiktokStatus = document.getElementById('tiktok-status');
const refreshBtn = document.getElementById('refresh-btn');
const doneBtn = document.getElementById('done-btn');
const toast = document.getElementById('toast');

// Fetch emails on load
window.addEventListener('DOMContentLoaded', fetchEmails);

async function fetchEmails() {
    emailList.innerHTML = '<div class="loader">Refreshing inbox...</div>';
    try {
        const response = await fetch('/api/emails');
        const data = await response.json();
        
        if (data.error) {
            emailList.innerHTML = `<div class="loader">Error: ${data.error}</div>`;
            return;
        }

        if (data.length === 0) {
            emailList.innerHTML = '<div class="loader">Inbox is empty</div>';
            return;
        }

        emailList.innerHTML = '';
        data.forEach(email => {
            const card = document.createElement('div');
            card.className = 'email-card';
            card.innerHTML = `
                <div class="email-header">
                    <span class="email-from">${email.from}</span>
                    <span class="email-date">${new Date(email.date).toLocaleTimeString()}</span>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${email.preview}</div>
            `;
            emailList.appendChild(card);
        });
    } catch (err) {
        emailList.innerHTML = '<div class="loader">Failed to connect to server</div>';
    }
}

findTikTokBtn.addEventListener('click', async () => {
    findTikTokBtn.disabled = true;
    tiktokStatus.textContent = 'Searching...';
    tiktokCodeInput.value = '';
    copyBtn.disabled = true;

    try {
        const response = await fetch('/api/tiktok-code');
        const data = await response.json();

        if (data.found) {
            tiktokCodeInput.value = data.code;
            copyBtn.disabled = false;
            tiktokStatus.textContent = 'Latest TikTok code found!';
            showToast('TikTok code extracted!');
        } else {
            tiktokStatus.textContent = data.message || 'No code found.';
            showToast('No code found in last 5 minutes', 'error');
        }
    } catch (err) {
        tiktokStatus.textContent = 'Error searching for code.';
    } finally {
        findTikTokBtn.disabled = false;
    }
});

copyBtn.addEventListener('click', () => {
    tiktokCodeInput.select();
    document.execCommand('copy');
    showToast('Code copied to clipboard!');
});

refreshBtn.addEventListener('click', fetchEmails);

doneBtn.addEventListener('click', async () => {
    if (!confirm('This will delete EVERY email in your inbox. Are you sure?')) return;
    
    doneBtn.disabled = true;
    doneBtn.textContent = 'Clearing...';

    try {
        const response = await fetch('/api/emails/clear', { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            showToast('Inbox cleared successfully!');
            fetchEmails();
        } else {
            showToast('Failed to clear inbox', 'error');
        }
    } catch (err) {
        showToast('Error clearing inbox', 'error');
    } finally {
        doneBtn.disabled = false;
        doneBtn.innerHTML = '<span class="btn-icon">🗑️</span> Done';
    }
});

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'success' ? 'var(--primary)' : 'var(--danger)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
