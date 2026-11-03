import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureDiagnostic } from '../src/feature-diagnostics.js';

test('distinguishes configuration and permissions from temporary failures', () => {
  assert.equal(featureDiagnostic(new Error('REVIEW_CHANNEL_ID is required')).category, 'CONFIGURATION');
  assert.equal(featureDiagnostic(Object.assign(new Error('Missing Permissions'), {code: 50013})).category, 'PERMISSION');
  assert.equal(featureDiagnostic(new Error('fetch failed', {cause: {code: 'ECONNRESET'}})).category, 'TRANSIENT');
  assert.equal(featureDiagnostic(Object.assign(new Error('service failed'), {status: 503})).category, 'TRANSIENT');
  assert.equal(featureDiagnostic(new Error('unexpected implementation error')).category, 'INTERNAL');
  assert.equal(featureDiagnostic(new Error('Channel 150013429123456789 is required')).category, 'CONFIGURATION');
});
test('redacts customer credentials before status reporting', () => {
  const result=featureDiagnostic(new Error('failed AQ.synthetic-customer.gemini-key token=private\n    at internal.ts:1'));
  assert.doesNotMatch(result.message,/synthetic-customer|token=private|internal.ts/);
  assert.match(result.message,/redacted/);
});
