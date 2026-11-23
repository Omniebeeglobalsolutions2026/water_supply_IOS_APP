const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'waterflow-test-secret-at-least-32-bytes';
process.env.CORS_ORIGIN = '*';
process.env.NODE_ENV = 'test';

const createApp = require('../src/app');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
});

test('liveness responds without depending on MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/health/live`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.ok(response.headers.get('x-request-id'));
});

test('readiness reports an unavailable database with a service-unavailable status', async () => {
  const response = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, 'disconnected');
});

test('unknown routes return a request-correlated not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  const payload = await response.json();
  assert.equal(response.status, 404);
  assert.equal(payload.message, 'Route not found.');
  assert.equal(payload.requestId, response.headers.get('x-request-id'));
});

test('invalid registration input returns a client error without database access', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'administrator' }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.message, /valid account type/i);
  assert.equal(payload.code, 'INVALID_ROLE');
});

test('admin vendor routes require an authenticated admin session', async () => {
  const response = await fetch(`${baseUrl}/api/admin/vendors`);
  assert.equal(response.status, 401);
  assert.match((await response.json()).message, /authentication required/i);
});

test('nearby vendor offer route validates delivery coordinates', async () => {
  const response = await fetch(`${baseUrl}/api/vendors/nearby?latitude=91&longitude=77.6&radiusKm=3`);
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.code, 'INVALID_COORDINATES');
});

test('vendor management routes require authentication', async () => {
  const response = await fetch(`${baseUrl}/api/vendor/profile`);
  assert.equal(response.status, 401);
  assert.match((await response.json()).message, /authentication required/i);
});