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

  const user = await request.json();
  const now = Date.now();
  
  // 插入或更新用户
  await env.DB.prepare(
    'INSERT OR REPLACE INTO users (id, email, name, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.id, user.email, user.name, user.picture, now, now).run();
  
  // 初始化配额
  const resetAt = new Date();
  resetAt.setMonth(resetAt.getMonth() + 1);
  
  await env.DB.prepare(
    'INSERT OR IGNORE INTO user_quotas (user_id, plan, monthly_limit, used_count, reset_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, 'free', 30, 0, resetAt.getTime()).run();

  return jsonResponse({ success: true });
}

async function handleProfile(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

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
}

async function handleRemoveBg(request, env) {
  const token = request.headers.get('Authorization');
  if (!token) {
    return jsonResponse({ error: '请先登录' }, 401);
  }

  // 解析用户ID
  const payload = JSON.parse(atob(token.replace('Bearer ', '').split('.')[1]));
  const userId = payload.sub;

  // 检查配额
  const quota = await env.DB.prepare(
    'SELECT * FROM user_quotas WHERE user_id = ?'
  ).bind(userId).first();

  if (!quota || quota.used_count >= quota.monthly_limit) {
    return jsonResponse({ error: '配额已用完，请升级套餐' }, 403);
  }

  // 处理图片
  const formData = await request.formData();
  const image = formData.get('image');
  
  const form = new FormData();
  form.append('image_file', image);
  form.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
    body: form
  });

  if (!response.ok) {
    return jsonResponse({ error: '处理失败' }, 500);
  }

  // 更新使用次数
  await env.DB.prepare(
    'UPDATE user_quotas SET used_count = used_count + 1 WHERE user_id = ?'
  ).bind(userId).run();

  return new Response(response.body, {
    headers: {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*'
    }
  });
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
