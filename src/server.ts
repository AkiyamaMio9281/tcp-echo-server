import { createServer, type Socket } from "node:net";

type ClientCommand =
  | { type: "PING" }
  | { type: "ECHO"; text: string }
  | { type: "RAW"; text: string };

type ServerResponse =
  | { type: "PONG" }
  | { type: "TEXT"; text: string };

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);
const MAX_LINE_BYTES = 64 * 1024;
const clients = new Map<Socket, number>();
let nextClientId = 1;

function parseCommand(line: string): ClientCommand {
  if (line === "PING") return { type: "PING" };
  if (line === "ECHO") return { type: "ECHO", text: "" };
  if (line.startsWith("ECHO ")) {
    return { type: "ECHO", text: line.slice(5) };
  }
  return { type: "RAW", text: line }; // Ordinary lines are echoed too.
}

function handleCommand(command: ClientCommand): ServerResponse {
  switch (command.type) {
    case "PING":
      return { type: "PONG" };
    case "ECHO":
    case "RAW":
      return { type: "TEXT", text: command.text };
  }
}

function formatResponse(response: ServerResponse): string {
  return response.type === "PONG" ? "PONG" : response.text;
}

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const server = createServer((socket) => {
  const id = nextClientId++;
  clients.set(socket, id);
  socket.setEncoding("utf8"); // Properly decodes split UTF-8 sequences.
  console.log(`Client #${id} connected (${clients.size} online)`);

  let buffer = "";
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    let newlineIndex: number;

    // TCP is a stream: a single chunk may contain half a line or many lines.
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
        socket.end("ERROR line too long\n");
        return;
      }
      socket.write(formatResponse(handleCommand(parseCommand(line))) + "\n");
    }

    if (Buffer.byteLength(buffer, "utf8") > MAX_LINE_BYTES) {
      socket.end("ERROR line too long\n");
    }
  });

  socket.on("error", (error: Error) => {
    console.error(`Client #${id}: ${error.message}`);
  });
  socket.on("close", () => {
    clients.delete(socket);
    console.log(`Client #${id} disconnected (${clients.size} online)`);
  });
});

server.on("error", (error: Error) => {
  console.error(`Server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    console.log(`TCP echo server listening on ${address.address}:${address.port}`);
  }
});
