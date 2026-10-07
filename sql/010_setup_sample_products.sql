-- 授業用の商品テーブルと3件のサンプル
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0)
);

INSERT INTO products (id, name, price) VALUES
  (1, 'ノート', 200),
  (2, 'ペン', 120),
  (3, '消しゴム', 80)
ON CONFLICT (id) DO NOTHING;

SELECT id, name, price FROM products ORDER BY id;