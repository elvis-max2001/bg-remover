-- 订阅套餐表
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  monthly_quota INTEGER NOT NULL,
  price REAL NOT NULL,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id, status);
