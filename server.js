import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import http from "http";
import { Server } from "socket.io";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
global.io = io;

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("joinRooms", (data) => {
    const { companyId, storeId, userId } = data;

    if (companyId) {
      socket.join(`company:${companyId}`);
    }

    if (storeId) {
      socket.join(`store:${storeId}`);
    }

    if (userId) {
      socket.join(`user:${userId}`);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✅ Nova ERP Server running on http://localhost:${PORT}`);
});
