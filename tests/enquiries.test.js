import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/enquiries-worker.js';
import { validateEnquiry } from '../src/lib/enquiry.js';
const origin = 'https://offthewall.studio';
const valid = () => ({ submissionId: crypto.randomUUID(), name: 'Test Person', company: 'Test Studio', email: 'test@example.com', website: 'example.com', projectInfo: 'A website project for our studio.', services: ['Web Design'], referral: '', budget: 'Under $3,000', launchDate: 'Next month' });
function setup({ mail = true, failMail = false } = {}) {
  const records = new Map(), sent = [], pending = [];
  let version = 0;
  const env = {
    ALLOWED_ORIGINS: origin, MAIL_FROM: mail ? 'notifications@offthewall.studio' : '',
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ENQUIRIES: {
      async get(key) { const v = records.get(key); return v ? { ...v, json: async () => JSON.parse(v.text) } : null; },
      async put(key, text, opts) {
        const old = records.get(key);
        if (opts.onlyIf instanceof Headers && old) return null;
        if (opts.onlyIf?.etagMatches && old?.etag !== opts.onlyIf.etagMatches) return null;
        const value = { etag: String(++version), text, customMetadata: opts.customMetadata };
        records.set(key, value); return value;
      },
      async list() { return { objects: [...records].map(([key,v]) => ({ key, customMetadata: v.customMetadata })), truncated: false }; },
    },
    EMAIL: { async send(message) { if (failMail) throw new Error('Unavailable'); sent.push(message); return { messageId: 'test-message' }; } },
  };
  const ctx = { waitUntil: promise => pending.push(promise) };
  const request = (body, customOrigin = origin) => new Request('https://api.example/submit', { method: 'POST', headers: { Origin: customOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const submit = body => worker.fetch(request(body), env, ctx);
  const drain = async () => { await Promise.all(pending.splice(0)); };
  return { env, ctx, records, sent, request, submit, drain };
}
test('validation requires services and deliberate budget, rejects whitespace and bad URLs', () => {
  const result = validateEnquiry({ ...valid(), name: '   ', services: [], budget: '', website: 'javascript:alert(1)' });
  assert.deepEqual(Object.keys(result.errors).sort(), ['budget', 'name', 'services', 'website']);
  assert.equal(validateEnquiry(valid()).data.website, 'https://example.com/');
  assert.equal(validateEnquiry({ ...valid(), email: 'x\r\nBcc:attacker@example.com' }).valid, false);
});
test('invalid data never writes to storage or sends email', async () => {
  const s = setup(); const res = await s.submit({ ...valid(), email: 'invalid', services: [] });
  assert.equal(res.status, 422); assert.equal(s.records.size, 0); assert.equal(s.sent.length, 0);
});
test('successful receipt persists data and sends an escaped notification with reply-to', async () => {
  const s = setup(); const data = { ...valid(), projectInfo: '<img src=x onerror=alert(1)>' };
  const res = await s.submit(data); assert.equal(res.status, 201); await s.drain();
  assert.equal(s.records.size, 1); assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, 'hello@offthewall.studio'); assert.equal(s.sent[0].replyTo, data.email);
  assert(!s.sent[0].html.includes('<img')); assert(s.sent[0].html.includes('&lt;img'));
  assert.equal(JSON.parse([...s.records.values()][0].text).notification.status, 'sent');
});
test('retries do not create duplicate enquiries or notifications', async () => {
  const s = setup(); const data = valid();
  const responses = await Promise.all([s.submit(data), s.submit(data)]); await s.drain();
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  assert.equal(s.records.size, 1); assert.equal(s.sent.length, 1);
  await s.submit(data); await s.drain(); assert.equal(s.sent.length, 1);
});
test('email failure leaves an acknowledged, durable receipt and retry state', async () => {
  const s = setup({ failMail: true }); const data = valid();
  assert.equal((await s.submit(data)).status, 201); await s.drain();
  const record = JSON.parse([...s.records.values()][0].text);
  assert.equal(record.notification.status, 'pending'); assert.equal(record.notification.attempts, 1);
  record.notification.nextAttemptAt = 0;
  s.records.get(`submissions/${data.submissionId}.json`).text = JSON.stringify(record);
  s.env.EMAIL.send = async m => { s.sent.push(m); return { messageId: 'retried' }; };
  await worker.scheduled({}, s.env);
  assert.equal(s.sent.length, 1); assert.equal(JSON.parse([...s.records.values()][0].text).notification.status, 'sent');
});
test('missing email configuration preserves pending records', async () => {
  const s = setup({ mail: false }); assert.equal((await s.submit(valid())).status, 201); await s.drain();
  assert.equal(s.sent.length, 0); assert.equal(JSON.parse([...s.records.values()][0].text).notification.status, 'pending');
});
test('storage failure cannot return success', async () => {
  const s = setup(); s.env.ENQUIRIES.put = async () => { throw new Error('Unavailable'); };
  assert.equal((await s.submit(valid())).status, 503); assert.equal(s.sent.length, 0);
});
test('rejects disallowed origins, honeypots, malformed JSON, oversized bodies and rate limits', async () => {
  const s = setup();
  assert.equal((await worker.fetch(s.request(valid(), 'https://attacker.example'), s.env, s.ctx)).status, 403);
  assert.equal((await s.submit({ ...valid(), companyWebsite: 'bot' })).status, 422);
  assert.equal((await worker.fetch(new Request('https://api.example/submit', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' }),s.env,s.ctx)).status, 400);
  assert.equal((await s.submit({ ...valid(), projectInfo: 'a'.repeat(25000) })).status, 413);
  s.env.RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await s.submit(valid())).status, 429); assert.equal(s.records.size, 0);
});
