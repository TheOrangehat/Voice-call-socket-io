const socket=io();

let localStream;
let peers={};

const cfg={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};

socket.on("connect",()=>document.getElementById("status").textContent="Connected");
socket.on("user-count",c=>document.getElementById("users").textContent="Users: "+c);

navigator.mediaDevices.getUserMedia({
 audio:{
  echoCancellation:true,
  noiseSuppression:true,
  autoGainControl:true
 }
}).then(stream=>{
 localStream=stream;
});

async function createPeer(id){
 const pc=new RTCPeerConnection(cfg);
 peers[id]=pc;

 localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));

 pc.onicecandidate=e=>{
   if(e.candidate){
      socket.emit("ice-candidate",{target:id,candidate:e.candidate});
   }
 };

 pc.ontrack=e=>{
   let a=document.getElementById("audio-"+id);
   if(!a){
      a=document.createElement("audio");
      a.id="audio-"+id;
      a.autoplay=true;
      document.body.appendChild(a);
   }
   a.srcObject=e.streams[0];
 };

 return pc;
}

socket.on("peers",async ids=>{
 for(const id of ids){
   const pc=await createPeer(id);
   const offer=await pc.createOffer();
   await pc.setLocalDescription(offer);
   socket.emit("offer",{target:id,offer});
 }
});

socket.on("offer",async({offer,from})=>{
 const pc=await createPeer(from);
 await pc.setRemoteDescription(offer);
 const answer=await pc.createAnswer();
 await pc.setLocalDescription(answer);
 socket.emit("answer",{target:from,answer});
});

socket.on("answer",async({answer,from})=>{
 await peers[from].setRemoteDescription(answer);
});

socket.on("ice-candidate",async({candidate,from})=>{
 if(peers[from]) await peers[from].addIceCandidate(candidate);
});

document.getElementById("mute").onclick=()=>{
 const t=localStream.getAudioTracks()[0];
 t.enabled=!t.enabled;
 document.getElementById("mute").textContent=t.enabled?"Mute":"Unmute";
};
