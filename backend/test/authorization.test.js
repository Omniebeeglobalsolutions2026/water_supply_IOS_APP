const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'waterflow-test-secret-at-least-32-bytes';

const authenticate = require('../src/middleware/authenticate');

function runRoleGuard(role) {
  let nextCalled = false;
  let statusCode = 200;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };
  authenticate.requireRole('admin')({ user: { role } }, response, () => { nextCalled = true; });
  return { nextCalled, statusCode, responseBody };
}

test('admin role guard allows admins', () => {
  assert.equal(runRoleGuard('admin').nextCalled, true);
});

test('admin role guard denies vendors and users', () => {
  for (const role of ['vendor', 'user']) {
    const result = runRoleGuard(role);
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 403);
    assert.match(result.responseBody.message, /permission/i);
  }
});
