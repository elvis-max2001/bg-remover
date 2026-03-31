export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // 路由
    if (url.pathname === '/api/user/init') {
      return handleUserInit(request, env);
    }
    if (url.pathname === '/api/user/profile') {
      return handleProfile(request, env);
    }
    if (url.pathname === '/api/subscribe') {
      return handleSubscribe(request, env);
    }
    if (url.pathname === '/remove-bg') {
      return handleRemoveBg(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleUserInit(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = await request.json();
    const now = Date.now();
    
    // 检查用户是否已存在
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(user.id).first();
    
    if (!existing) {
      // 新用户：插入用户信息
      await env.DB.prepare(
        'INSERT INTO users (id, email, name, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(user.id, user.email, user.name, user.picture, now, now).run();
      
      // 新用户送3次免费额度
      const resetAt = new Date();
      resetAt.setMonth(resetAt.getMonth() + 1);
      
      await env.DB.prepare(
        'INSERT INTO user_quotas (user_id, plan, monthly_limit, used_count, reset_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(user.id, 'free', 3, 0, resetAt.getTime()).run();
    } else {
      // 已存在用户：更新信息
      await env.DB.prepare(
        'UPDATE users SET name = ?, avatar = ?, updated_at = ? WHERE id = ?'
      ).bind(user.name, user.picture, now, user.id).run();
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

async function handleProfile(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    // 从 JWT token 解析用户ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;
    
    // 查询用户配额
    const quota = await env.DB.prepare(
      'SELECT * FROM user_quotas WHERE user_id = ?'
    ).bind(userId).first();

    // 查询用户信息
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    return jsonResponse({
      user: user || {},
      quota: quota || { plan: 'free', monthly_limit: 30, used_count: 0 }
    });
  } catch (e) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }
}

async function handleRemoveBg(request, env) {
  const token = request.headers.get('Authorization');
  if (!token) {
    return jsonResponse({ error: '请先登录' }, 401);
  }

  try {
    const payload = JSON.parse(atob(token.replace('Bearer ', '').split('.')[1]));
    const userId = payload.sub;

    // 检查配额
    const quota = await env.DB.prepare(
      'SELECT * FROM user_quotas WHERE user_id = ?'
    ).bind(userId).first();

    if (!quota || quota.used_count >= quota.monthly_limit) {
      return jsonResponse({ error: '配额已用完，请订阅套餐' }, 403);
    }

    // 处理图片 - 使用 Replicate RMBG-1.4 (约 $0.0023/次)
    const formData = await request.formData();
    const image = formData.get('image');
    
    // 转换为 base64
    const buffer = await image.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const dataUrl = `data:${image.type};base64,${base64}`;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
        input: { image: dataUrl }
      })
    });

    const result = await response.json();
    
    // 轮询结果
    let output = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const check = await fetch(result.urls.get, {
        headers: { 'Authorization': `Token ${env.REPLICATE_API_TOKEN}` }
      });
      const status = await check.json();
      if (status.status === 'succeeded') {
        output = status.output;
        break;
      }
      if (status.status === 'failed') {
        return jsonResponse({ error: '处理失败' }, 500);
      }
    }

    if (!output) {
      return jsonResponse({ error: '处理超时' }, 500);
    }

    // 更新使用次数
    await env.DB.prepare(
      'UPDATE user_quotas SET used_count = used_count + 1 WHERE user_id = ?'
    ).bind(userId).run();

    // 下载并返回结果
    const imgResponse = await fetch(output);
    return new Response(imgResponse.body, {
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleSubscribe(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;
    const { plan } = await request.json();

    const plans = {
      basic: { quota: 100, price: 9.99 },
      pro: { quota: 500, price: 29.99 },
      unlimited: { quota: 99999, price: 99.99 }
    };

    if (!plans[plan]) {
      return jsonResponse({ error: 'Invalid plan' }, 400);
    }

    const now = Date.now();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    // 更新配额
    await env.DB.prepare(
      'UPDATE user_quotas SET plan = ?, monthly_limit = ?, used_count = 0, reset_at = ? WHERE user_id = ?'
    ).bind(plan, plans[plan].quota, endDate.getTime(), userId).run();

    return jsonResponse({ success: true, plan, quota: plans[plan].quota });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
