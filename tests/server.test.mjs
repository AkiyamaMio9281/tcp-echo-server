import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { after, before, test } from 'node:test';

let server;
let port;

before(async () => {
  server = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Server start timed out')), 5000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Server exited: ${code}`)));
    server.stdout.on('data', (data) => {
      output += data.toString();
      const match = output.match(/listening on 127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
  });
});

after(() => server?.kill());

function exchange(lines, expectedCount = lines.join('').split('\n').length - 1) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    let response = '';
    let received = 0;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Response timed out'));
    }, 3000);
    socket.on('error', reject);
    socket.on('connect', () => {
      for (const line of lines) socket.write(line);
    });
    socket.on('data', (data) => {
      response += data.toString();
      received = response.split('\n').length - 1;
      if (received >= expectedCount) {
        clearTimeout(timeout);
        socket.end();
        resolve(response);
      }
    });
  });
}

test('PING, ECHO, ordinary echo, and empty ECHO', async () => {
  const result = await exchange(['PING\nECHO hi there\nhello\nECHO\n']);
  assert.equal(result, 'PONG\nhi there\nhello\n\n');
});

test('correctly assembles fragmented TCP lines', async () => {
  const result = await exchange(['EC', 'HO 你好', '世界\n']);
  assert.equal(result, '你好世界\n');
});

test('handles two simultaneous clients independently', async () => {
  const [first, second] = await Promise.all([
    exchange(['PING\nECHO client-1\n']),
    exchange(['ECHO client-2\nPING\n']),
  ]);
  assert.equal(first, 'PONG\nclient-1\n');
  assert.equal(second, 'client-2\nPONG\n');
});

test('accepts CRLF line endings', async () => {
  const result = await exchange(['PING\r\nECHO ok\r\n']);
  assert.equal(result, 'PONG\nok\n');
});

test('rejects lines larger than 64 KiB', async () => {
  const result = await exchange(['x'.repeat(64 * 1024 + 1) + '\n']);
  assert.equal(result, 'ERROR line too long\n');
});
