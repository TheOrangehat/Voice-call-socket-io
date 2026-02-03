// Connect to server (io comes from CDN)
const socket = io("https://voice-call-socket-io.onrender.com", {
  transports: ["websocket"],
  upgrade: false,
});

socket.on("connect", () => {
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      let audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", function (event) {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", function () {
        const audioBlob = new Blob(audioChunks);
        audioChunks = [];

        const fileReader = new FileReader();
        fileReader.readAsDataURL(audioBlob);

        fileReader.onloadend = function () {
          const base64String = fileReader.result;
          socket.emit("audioStream", base64String);
        };

        // Restart recording
        mediaRecorder.start();

        setTimeout(function () {
          mediaRecorder.stop();
        }, 1000);
      });

      // Start first recording
      mediaRecorder.start();

      setTimeout(function () {
        mediaRecorder.stop();
      }, 1000);
    })
    .catch((error) => {
      console.error("Error capturing audio:", error);
    });
});

socket.on("audioStream", (audioData) => {
  let newData = audioData.split(";");

  newData[0] = "data:audio/ogg;";
  newData = newData[0] + newData[1];

  const audio = new Audio(newData);

  if (!audio || document.hidden) return;

  audio.play();
});
