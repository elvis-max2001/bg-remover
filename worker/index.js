/**
 * Cloudflare Worker - remove.bg API proxy
 * 环境变量：REMOVE_BG_API_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST' || new URL(request.url).pathname !== '/remove-bg') {
      return new Response('Not Found', { status: 404 });
    }

    const apiKey = env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 接收前端传来的 multipart/form-data
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid form data' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const imageFile = formData.get('image');
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 转发给 remove.bg
    const rbForm = new FormData();
    rbForm.append('image_file', imageFile);
    rbForm.append('size', 'auto');

    const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: rbForm,
    });

    if (!rbRes.ok) {
      const errText = await rbRes.text();
      return new Response(JSON.stringify({ error: `remove.bg error: ${errText}` }), {
        status: rbRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 直接把 PNG 二进制流返回给前端
    const imageBuffer = await rbRes.arrayBuffer();
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="removed-bg.png"',
      },
    });
  },
};
