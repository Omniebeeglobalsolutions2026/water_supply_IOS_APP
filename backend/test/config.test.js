const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const backendDirectory = path.resolve(__dirname, '..');

function loadConfig(environment) {
  return spawnSync(process.execPath, ['-e', "require('./src/config/env')"], {
    cwd: backendDirectory,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

test('configuration refuses missing or placeholder JWT secrets', () => {
  const missingSecret = loadConfig({ JWT_SECRET: '' });
  const placeholderSecret = loadConfig({ JWT_SECRET: 'replace-this-with-a-long-but-public-secret-value' });

  assert.notEqual(missingSecret.status, 0);
  assert.match(missingSecret.stderr, /JWT_SECRET must be set/);
  assert.notEqual(placeholderSecret.status, 0);
});

test('configuration rejects a minimum Mongo pool larger than its maximum', () => {
  const result = loadConfig({
    JWT_SECRET: 'waterflow-test-secret-at-least-32-bytes',
    MONGO_MIN_POOL_SIZE: '21',
    MONGO_MAX_POOL_SIZE: '20',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MONGO_MIN_POOL_SIZE must be an integer/);
});

test('configuration requires Razorpay API key and secret as a pair', () => {
  const result = loadConfig({
    JWT_SECRET: 'waterflow-test-secret-at-least-32-bytes',
    RAZORPAY_KEY_ID: 'rzp_test_example',
    RAZORPAY_KEY_SECRET: '',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be configured/);
});