-- TODOアプリ用のテーブル（doc/todo/03_implementation_plan_md.md Step 1〜2）
CREATE TABLE IF NOT EXISTS todo_tasks (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- テーブルが作成されたことを確認する（todo_tasks の1行が返れば成功）
SELECT table_name FROM information_schema.tables WHERE table_name = 'todo_tasks';
