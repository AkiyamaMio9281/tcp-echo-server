# TCP Echo Server (TypeScript)

A small, line-oriented TCP server for learning Node.js networking and TypeScript.

## Features

- Supports multiple simultaneous TCP clients; logs the number connected.
- `PING` -> `PONG`, `ECHO <text>` -> `<text>`, and ordinary lines echo unchanged.
- Explicit TypeScript union types for commands and responses.
- Handles TCP message fragmentation/coalescing: one request per newline (`\n`), accepts CRLF (`\r\n`).
- Limits each line to 64 KiB; binds to localhost by default.

## Requirements

Node.js 20+ and npm.

## Run

```bash
npm install
npm run dev
```

Or build and run compiled JavaScript:

```bash
npm run build
npm start
```

To change the port, set `PORT` in the environment (default `3000`). Set `HOST` to listen on another interface (default `127.0.0.1`).

## Test from a second terminal

With netcat:

```bash
nc 127.0.0.1 3000
```

Then type:

```text
PING
ECHO hello world
hello
```

The responses will be:

```text
PONG
hello world
hello
```

You can open another terminal and connect again; both clients will work independently.

Cross-platform alternative if `nc` isn't installed (Node.js only):

```bash
node -e "const s=require('node:net').connect(3000,'127.0.0.1');s.on('data',d=>process.stdout.write(d));process.stdin.pipe(s)"
```

## Automated tests

```bash
npm test
```

The protocol is **line-delimited text**. Each request must end in `\n`, and every response ends in `\n`. This is why the server buffers partial TCP chunks instead of treating every `data` event as one complete request.
