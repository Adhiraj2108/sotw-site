import { validateEnquiry } from '../src/lib/enquiry.js';

const MAX_BYTES = 24000;
const json = (body, status, headers) => Response.json(body, { status, headers });
const encode = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const metadata = record => ({ contentType: 'application/json', cacheControl: 'no-store' });
const options = (record, onlyIf) => ({ httpMetadata: metadata(record), customMetadata: { notification: record.notification.status }, ...(onlyIf ? { onlyIf } : {}) });

async function notify(env, key) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const object = await env.ENQUIRIES.get(key);
  if (!object) return;
  const record = await object.json();
  const now = Date.now();
  if (record.notification.status === 'sent' || (record.notification.nextAttemptAt || 0) > now) return;
  if (record.notification.status === 'sending' && record.notification.leaseUntil > now) return;
  record.notification.status = 'sending';
  record.notification.leaseUntil = now + 300000;
  const lease = await env.ENQUIRIES.put(key, JSON.stringify(record), options(record, { etagMatches: object.etag }));
  if (!lease) return;
  try {
    const rows = [ ['Reference', record.id], ['Received (UTC)', record.createdAt], ...Object.entries(record.data).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]) ];
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `enquiry/${record.id}`,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: `Studio Off The Wall <${env.MAIL_FROM}>`,
        to: ['hello@offthewall.studio'],
        reply_to: record.data.email,
        subject: `New project enquiry from ${record.data.name}`,
        text: rows.map(([key, value]) => `${key}: ${value}`).join('\n\n'),
        html: `<h1>New project enquiry</h1>${rows.map(([key, value]) => `<p><strong>${encode(key)}</strong><br>${encode(value).replace(/\n/g, '<br>')}</p>`).join('')}`,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error('Resend request failed'), { code: `RESEND_HTTP_${response.status}` });
    }
    const result = await response.json();
    if (typeof result.id !== 'string' || !result.id) throw Object.assign(new Error('Missing Resend message ID'), { code: 'RESEND_INVALID_RESPONSE' });
    record.notification = { status: 'sent', provider: 'resend', sentAt: new Date().toISOString(), messageId: result.id };
  } catch (error) {
    const attempts = (record.notification.attempts || 0) + 1;
    record.notification = { status: 'pending', attempts, nextAttemptAt: now + Math.min(3600000, 60000 * 2 ** Math.min(attempts, 6)) };
    console.error(JSON.stringify({ message: 'Enquiry notification failed; queued for retry', id: record.id, code: error.code || 'SEND_FAILED' }));
  }
  await env.ENQUIRIES.put(key, JSON.stringify(record), options(record, { etagMatches: lease.etag }));
}

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BAD_JSON');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    if (!origin || !allowed.includes(origin)) return json({ error: 'This website is not allowed to submit this form.' }, 403, headers);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    if (new URL(request.url).pathname !== '/submit') return json({ error: 'Not found.' }, 404, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Please submit JSON.' }, 415, headers);
    try {
      const rate = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!rate.success) { headers.set('Retry-After', '60'); return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, headers); }
      let input;
      try { input = await readBody(request); }
      catch (error) { return json({ error: error.message === 'TOO_LARGE' ? 'Please shorten your project details.' : 'Invalid form data.' }, error.message === 'TOO_LARGE' ? 413 : 400, headers); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid form data.' }, 400, headers);
      if (input.companyWebsite) return json({ error: 'Unable to submit. Please email hello@offthewall.studio.' }, 422, headers);
      const validated = validateEnquiry(input);
      if (!validated.valid) return json({ error: 'Please check the highlighted fields.', errors: validated.errors }, 422, headers);
      if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.submissionId || '')) return json({ error: 'Please refresh the page and try again.' }, 422, headers);
      const id = input.submissionId;
      const key = `submissions/${id}.json`;
      const record = { id, createdAt: new Date().toISOString(), data: validated.data, notification: { status: 'pending' } };
      const saved = await env.ENQUIRIES.put(key, JSON.stringify(record), options(record, new Headers({ 'If-None-Match': '*' })));
      // A repeated request acknowledges the original receipt without changing its contents.
      ctx.waitUntil(notify(env, key).catch(() => console.error(JSON.stringify({ message: 'Notification retry required', id }))));
      return json({ ok: true, id }, saved ? 201 : 200, headers);
    } catch {
      console.error(JSON.stringify({ message: 'Enquiry storage request failed' }));
      return json({ error: 'We could not save your enquiry. Please try again or email hello@offthewall.studio.' }, 503, headers);
    }
  },
  async scheduled(event, env) {
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return;
    let cursor;
    do {
      const page = await env.ENQUIRIES.list({ prefix: 'submissions/', limit: 100, cursor, include: ['customMetadata'] });
      for (const object of page.objects) {
        if (object.customMetadata?.notification !== 'sent') await notify(env, object.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  },
};
