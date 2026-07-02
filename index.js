// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
  cors:{origin:"*"}
});

app.use(express.static("public"));

let users = 0;

io.on("connection",(socket)=>{
  users++;
  io.emit("user-count", users);

  socket.on("offer",(data)=>socket.to(data.target).emit("offer",{offer:data.offer,from:socket.id}));
  socket.on("answer",(data)=>socket.to(data.target).emit("answer",{answer:data.answer,from:socket.id}));
  socket.on("ice-candidate",(data)=>socket.to(data.target).emit("ice-candidate",{candidate:data.candidate,from:socket.id}));

  socket.emit("your-id",socket.id);
  socket.emit("peers",[...io.sockets.sockets.keys()].filter(id=>id!==socket.id));

  socket.on("disconnect",()=>{
    users--;
    io.emit("user-count",users);
  });
});

server.listen(process.env.PORT||3000,()=>console.log("Server running"));
