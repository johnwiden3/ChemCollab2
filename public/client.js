const socket = io();
const ketcherIframe = document.getElementById('ketcher-iframe');
const sendStructureBtn = document.getElementById('send-structure-btn');
const statusMessagesDiv = document.getElementById('status-messages');

let ketcher; // To hold the Ketcher API object from the iframe
let lastSentMolfile = ''; // To prevent sending identical data repeatedly

function logStatus(message) {
    const p = document.createElement('p');
    p.textContent = message;
    statusMessagesDiv.prepend(p); // Add to top
    if (statusMessagesDiv.children.length > 5) { // Keep only last 5 messages
        statusMessagesDiv.removeChild(statusMessagesDiv.lastChild);
    }
}

// --- Communication with Ketcher in the iframe ---

// Event listener for when the iframe content (Ketcher) is loaded
ketcherIframe.onload = () => {
    // Access the ketcher object from the iframe's contentWindow
    // This is the standard way to get the Ketcher API when it's in an iframe.
    try {
        ketcher = ketcherIframe.contentWindow.ketcher;
        if (ketcher) {
            logStatus('Ketcher loaded and API accessible.');
        } else {
            logStatus('Error: Ketcher API not found in iframe contentWindow.');
        }
    } catch (error) {
        logStatus(`Error accessing Ketcher API: ${error.message}`);
    }
};

// Function to get MOLfile from Ketcher
async function getMolfileFromKetcher() {
    if (!ketcher) {
        logStatus('Ketcher not ready yet.'); // This logStatus is probably fine
        return null;
    }
    try {
        const molfile = await ketcher.getMolfile();
        console.log('Molfile returned by Ketcher.getMolfile():', molfile); // ADD THIS LINE
        if (!molfile || molfile.trim() === '') {
            logStatus('Warning: Ketcher returned empty or whitespace MOLfile.'); // Refine the warning
            return ''; // Return an empty string
        }
        return molfile;
    } catch (error) {
        logStatus(`Error getting MOLfile from Ketcher: ${error.message}`);
        console.error('Error from ketcher.getMolfile():', error); // ADD THIS FOR DETAILED ERRORS
        return null;
    }
}

// Function to set MOLfile in Ketcher
async function setMolfileInKetcher(molfile) {
    if (!ketcher) {
        logStatus('Ketcher not ready yet for setting structure.');
        return;
    }
    try {
        // Ketcher's setMolecule() expects a MOLfile string and returns a Promise
        await ketcher.setMolecule(molfile);
        logStatus('Ketcher canvas updated with received structure.');
    } catch (error) {
        logStatus(`Error setting MOLfile in Ketcher: ${error.message}`);
    }
}

// --- Socket.IO Communication ---

// Event listener for the "Send Structure" button
sendStructureBtn.addEventListener('click', async () => {
    const currentMolfile = await getMolfileFromKetcher();
    console.log('Molfile retrieved from Ketcher:', currentMolfile);
if (!currentMolfile || currentMolfile.trim() === '') {
    console.warn('Warning: Molfile appears empty or only whitespace.');
}
    if (currentMolfile && currentMolfile !== lastSentMolfile) {
        logStatus('Sending structure update...');
        socket.emit('drawingUpdate', currentMolfile);
        lastSentMolfile = currentMolfile; // Update lastSentMolfile after sending
    } else if (currentMolfile === lastSentMolfile) {
        logStatus('Structure unchanged, not sending.');
    } else {
        logStatus('No structure to send.');
    }
});

// Listen for initial structure from the server (when connecting)
socket.on('initialStructure', (molfile) => {
    if (molfile) {
        logStatus('Received initial structure from server.');
        setMolfileInKetcher(molfile);
        lastSentMolfile = molfile; // Sync initial state
        console.log('Received initial structure (client side):', molfile);
    }
});

// Listen for drawing updates from the server (from other users)
socket.on('drawingUpdate', (molfile) => {
    if (molfile && molfile !== lastSentMolfile) { // Only update if different from what we last sent
        logStatus('Received real-time update from another user.');
        setMolfileInKetcher(molfile);
        lastSentMolfile = molfile; // Update lastSentMolfile after receiving and applying
    } else if (molfile === lastSentMolfile) {
        // This can happen if the server echoes our own message, which is fine
        // logStatus('Received own update back (echo).');
        console.log('Received drawing update (client side):', molfile);
    }
});

socket.on('connect', () => {
    logStatus('Connected to server.');
});

socket.on('disconnect', () => {
    logStatus('Disconnected from server.');
});

socket.on('connect_error', (err) => {
    logStatus(`Connection error: ${err.message}`);
});