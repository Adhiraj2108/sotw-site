// Public, read-only delivery for the studio's R2 media bucket.
export default {
  async fetch(request, env) {
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-None-Match',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
    let key;
    try { key = decodeURIComponent(new URL(request.url).pathname.slice(1)); }
    catch { return new Response('Invalid path', { status: 400, headers }); }
    if (!key || key.split('/').some(part => part === '..')) return new Response('Not found', { status: 404, headers });
    try {
      const object = request.method === 'HEAD'
        ? await env.ASSETS.head(key)
        : await env.ASSETS.get(key, request.headers.has('Range') ? { range: request.headers } : {});
      if (!object) return new Response('Not found', { status: 404, headers });
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=86400');
      if (request.headers.get('If-None-Match') === object.httpEtag) {
        if (object.body) await object.body.cancel();
        return new Response(null, { status: 304, headers });
      }
      let status = 200;
      if (request.method === 'GET' && request.headers.has('Range') && object.range) {
        const { offset, length } = object.range;
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set('Content-Length', String(length));
        status = 206;
      } else headers.set('Content-Length', String(object.size));
      return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
    } catch (error) {
      console.error(JSON.stringify({ message: 'Asset read failed', key, error: String(error) }));
      return new Response('Asset unavailable', { status: 503, headers });
    }
  },
};
