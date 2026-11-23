import http from "http";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

const PORT = 3001;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  let filename;
  let contentType;

  if (pathname === "/") {
    filename = "index.html";
    contentType = "text/html";
  } else if (pathname === "/script.js") {
    filename = "script.js";
    contentType = "text/javascript";
  } else {
    res.writeHead(404);
    return res.end("Not found");
  }

  const filePath = new URL(
    `./public/${filename}`,
    import.meta.url
  );

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading file");
    }

    if (filename === "script.js") {
      // Adapta la conexión al puerto abierto en Codespaces.
      data = data.replace(
        "ws://localhost:3001",
        '${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}'
      );
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const message = JSON.stringify(payload);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on("connection", (socket, req) => {
  const username = new URL(
    req.url,
    "http://localhost"
  ).searchParams.get("username") || "Anonymous";

  broadcast({
    type: "system",
    text: `${username} joined`
  });

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (
        typeof message.username !== "string" ||
        typeof message.text !== "string"
      ) {
        return;
      }

      broadcast({
        type: "chat",
        username: message.username,
        text: message.text
      });
    } catch (err) {
      console.error("Invalid message:", err.message);
    }
  });

  socket.on("close", () => {
    broadcast({
      type: "system",
      text: `${username} left`
    });
  });

  socket.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

server.listen(PORT, () => {
  console.log("Chat server running at http://localhost:3001");
});
