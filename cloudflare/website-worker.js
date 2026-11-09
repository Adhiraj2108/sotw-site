export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.offthewall.studio') {
      url.hostname = 'offthewall.studio';
      url.protocol = 'https:';
      return Response.redirect(url.href, 301);
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(response.body, { status: response.status, headers });
  },
};
