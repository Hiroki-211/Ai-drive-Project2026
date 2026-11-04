// API / JSONで扱うTODO（camelCase）
export interface Todo {
  id: number;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

// DB（todo_tasks）から取得する行（snake_case）
export interface DbTodoRow {
  id: number;
  title: string;
  is_completed: boolean;
  created_at: Date;
}

// APIのレスポンス形式（成功時: status + data / 失敗時: status + code + message + details）
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  code?: string;
  message?: string;
  details?: any[];
}
