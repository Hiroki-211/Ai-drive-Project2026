import { pool } from '../../../db'; // db.tsで作成したNeonへの接続を利用する
import { Todo, DbTodoRow } from './types';

export class TodoService {
  // DBの行（snake_case）をAPI用のオブジェクト（camelCase）に変換する
  private static mapToTodo(row: DbTodoRow): Todo {
    return {
      id: row.id,
      title: row.title,
      isCompleted: row.is_completed,
      createdAt: row.created_at.toISOString(),
    };
  }

  // REQ-01: 一覧取得
  async getAll(): Promise<Todo[]> {
    const res = await pool.query<DbTodoRow>(
      'SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id DESC;'
    );
    return res.rows.map(TodoService.mapToTodo);
  }

  // REQ-02: 新規登録
  async create(title: string): Promise<Todo> {
    const res = await pool.query<DbTodoRow>(
      'INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed, created_at;',
      [title]
    );
    return TodoService.mapToTodo(res.rows[0]);
  }

  // REQ-03: 完了状態の更新（対象が存在しない場合はnullを返す）
  async updateStatus(id: number, isCompleted: boolean): Promise<Todo | null> {
    const res = await pool.query<DbTodoRow>(
      'UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at;',
      [isCompleted, id]
    );
    if (res.rows.length === 0) return null;
    return TodoService.mapToTodo(res.rows[0]);
  }

  // REQ-04: 削除（削除できた場合はtrueを返す）
  async delete(id: number): Promise<boolean> {
    const res = await pool.query(
      'DELETE FROM todo_tasks WHERE id = $1 RETURNING id;',
      [id]
    );
    return res.rows.length > 0;
  }
}
