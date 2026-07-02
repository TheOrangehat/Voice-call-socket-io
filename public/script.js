const socket = io("https://voice-call-socket-io.onrender.com", {
  transports: ["websocket"],
  upgrade: false,
});

// State
let localStream;
let mediaRecorder;
let audioContext;
let analyser;
let microphone;
let dataArray;
let isMuted = false;
let remoteAudioSources = {}; // Map socketId -> AudioBufferSourceNode

// UI Elements
const statusText = document.getElementById("status");
const micBtn = document.getElementById("micBtn");
const usersList = document.getElementById("usersList");
const canvas = document.getElementById("visualizer");
const canvasCtx = canvas.getContext("2d");

// Initialize Audio Context (must be user triggered)
async function initAudio() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: true, 
                noiseSuppression: true, 
                autoGainControl: true 
            } 
        });

        // Setup Visualizer
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        microphone = audioContext.createMediaStreamSource(localStream);
        microphone.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer();

        // Setup Recorder for Streaming (Raw PCM/Opus chunks)
        // Using a small chunk size (20ms) for low latency
        mediaRecorder = new MediaRecorder(localStream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && !isMuted) {
                // Convert Blob to ArrayBuffer for efficient binary transfer
                const reader = new FileReader();
                reader.readAsArrayBuffer(event.data);
                reader.onloadend = () => {
                    socket.emit('audioChunk', reader.result);
                };
            }
        };

        // Record 20ms chunks (approx 480 samples at 24kHz)
        mediaRecorder.start(20); 

        micBtn.innerText = "🔇 Mute";
        micBtn.style.background = "#ff4444";
        statusText.innerText = "🟢 Live & Listening";

    } catch (err) {
        console.error("Error accessing microphone:", err);
        statusText.innerText = "❌ Microphone Access Denied";
        statusText.style.color = "#ff4444";
    }
}

// Toggle Mute
micBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
        micBtn.innerText = "🔊 Unmute";
        micBtn.style.background = "#00ff99";
        statusText.innerText = "🔇 Muted";
        socket.emit('muteStatus', { id: socket.id, isMuted: true });
    } else {
        micBtn.innerText = "🔇 Mute";
        micBtn.style.background = "#ff4444";
        statusText.innerText = "🟢 Live & Listening";
        socket.emit('muteStatus', { id: socket.id, isMuted: false });
    }
});

// Handle Incoming Audio (Binary Buffer)
socket.on('audioChunk', (buffer) => {
    if (!audioContext) return;

    // Decode audio data to play it
    audioContext.decodeAudioData(buffer, (buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        // Connect to destination (speakers)
        source.connect(audioContext.destination);
        source.start();
    }, (e) => console.error("Error decoding audio data", e));
});

// Handle User List Updates
socket.on('updateUsers', (users) => {
    usersList.innerHTML = '';
    users.forEach(userId => {
        if (userId !== socket.id) {
            const div = document.createElement('div');
            div.className = 'user-item';
            div.innerText = `User ${userId.substring(0, 4)}...`;
            usersList.appendChild(div);
        }
    });
    if(users.length <= 1) {
        usersList.innerHTML = '<div class="user-item">No other users online</div>';
    }
});

// Visualizer Loop
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 100)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

socket.on('connect', () => {
    statusText.innerText = "Connecting...";
    initAudio();
});

socket.on('disconnect', () => {
    statusText.innerText = "Disconnected from server";
    statusText.style.color = "#ff4444";
});
