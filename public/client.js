const socket = io();
const ketcherIframe = document.getElementById('ketcher-iframe');
const sendStructureBtn = document.getElementById('send-structure-btn');
const statusMessagesDiv = document.getElementById('status-messages');

let ketcher; // This will hold the ketcher API object
let lastSentMolfile = ''; // For preventing unnecessary updates, and for initial structure storage

function logStatus(message) {
    if (statusMessagesDiv) {
        const p = document.createElement('p');
        p.textContent = message;
        statusMessagesDiv.prepend(p); // Add to top
        if (statusMessagesDiv.children.length > 5) {
            statusMessagesDiv.removeChild(statusMessagesDiv.lastChild);
        }
    } else {
        console.error("logStatus called but statusMessagesDiv is null!");
    }
}

// --- Communication with Ketcher in the iframe ---

ketcherIframe.onload = () => {
    logStatus('IFRAME ONLOAD FIRED.'); // Confirmed this fires

    let attempts = 0;
    const maxAttempts = 50; // Increased attempts significantly
    const delay = 100;    // Check every 100ms for faster polling

    logStatus('Starting polling for Ketcher API...'); // NEW LOG

    const checkKetcherReady = setInterval(() => {
        attempts++;
        if (ketcherIframe.contentWindow && ketcherIframe.contentWindow.ketcher) {
            ketcher = ketcherIframe.contentWindow.ketcher;
            logStatus(`Ketcher API found after ${attempts * delay}ms.`);
            
            // If we received an initial structure before Ketcher was ready, set it now
            if (lastSentMolfile) { // 'lastSentMolfile' could hold the last known good structure
                logStatus('Attempting to set initial structure after Ketcher API found.');
                setMolfileInKetcher(lastSentMolfile); // Try setting the structure again
            }
            
            clearInterval(checkKetcherReady); // Stop checking
        } else {
            logStatus(`Attempt ${attempts}/${maxAttempts}: Ketcher API not yet found.`); // NEW LOG, more detailed
            if (attempts >= maxAttempts) {
                logStatus('Error: Ketcher API not found in iframe contentWindow after all attempts.'); // NEW LOG, specific error
                clearInterval(checkKetcherReady);
            }
        }
    }, delay);
};

async function getMolfileFromKetcher() {
    if (!ketcher) {
        logStatus('Ketcher not ready yet (getMolfile).'); // NEW LOG for getMolfile
        return null;
    }
    try {
        const molfile = await ketcher.getMolfile();
        // logStatus('Molfile retrieved from Ketcher.'); // Uncomment for debug if needed
        return molfile;
    } catch (error) {
        logStatus(`Error getting MOLfile from Ketcher: ${error.message}`);
        console.error('Error from ketcher.getMolfile():', error);
        return null;
    }
}

async function setMolfileInKetcher(molfile) {
    if (!ketcher) {
        logStatus('Ketcher not ready yet for setting structure. Structure will be set when Ketcher is ready.'); // Confirmed this fires
        lastSentMolfile = molfile; // Store the molfile to set once ketcher is ready
        return;
    }
    if (!molfile || molfile.trim() === '') { // Prevent setting empty structures
        logStatus('Warning: Attempted to set empty or whitespace Molfile.');
        return;
    }
    try {
        await ketcher.setMolecule(molfile);
        logStatus('Ketcher canvas updated with received structure.');
    } catch (error) {
        logStatus(`Error setting MOLfile in Ketcher: ${error.message}`);
        console.error('Error in setMolecule:', error);
    }
}

// --- Socket.IO Event Handlers ---

// When a new user connects or on initial load, server sends existing structure
socket.on('initialStructure', (molfile) => {
    logStatus('Received initial structure from server.'); // Confirmed this fires
    if (molfile && molfile !== lastSentMolfile) {
        setMolfileInKetcher(molfile);
    }
    // Note: lastSentMolfile is updated inside setMolfileInKetcher if ketcher is ready
    // or if the initial structure is queued
});

// When another user sends a drawing update
socket.on('drawingUpdate', (molfile) => {
    if (molfile && molfile !== lastSentMolfile) {
        logStatus('Received real-time update from another user.');
        setMolfileInKetcher(molfile);
    } else if (molfile === lastSentMolfile) {
        logStatus('Received own update back (echo) or identical structure. Not updating.');
    }
});

// --- Send Button Listener ---
sendStructureBtn.addEventListener('click', async () => {
    if (!ketcher) {
        logStatus('Ketcher not ready. Cannot send structure.'); // Confirmed this fires
        return;
    }
    const currentMolfile = await getMolfileFromKetcher();
    
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

// Initial connection log
socket.on('connect', () => {
    logStatus('Connected to server.');
});

socket.on('disconnect', () => {
    logStatus('Disconnected from server.');
});

// Added a check for initial Ketcher access
logStatus('client.js loaded. Checking for Ketcher API...');
if (ketcherIframe.contentWindow && ketcherIframe.contentWindow.ketcher) {
    ketcher = ketcherIframe.contentWindow.ketcher;
    logStatus('Ketcher loaded and API accessible on client.js load.');
} else {
    logStatus('Ketcher not immediately available on client.js load. Waiting for iframe onload.');
}