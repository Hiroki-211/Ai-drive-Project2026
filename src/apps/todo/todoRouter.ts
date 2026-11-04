import express, { NextFunction, Request, Response, Router } from 'express';
import { TodoService } from './todoService';
import { ApiResponse, Todo } from './types';

const TITLE_MAX_LENGTH = 100;
const PG_INTEGER_MAX = 2147483647; // todo_tasks.id（INTEGER）の上限

const todoRouter = Router();
const todoService = new TodoService();


// ------------------------------
// 共通処理
// ------------------------------

// 標準エラーフォーマットで返す
function sendError(res: Response, status: number, code: string, message: string): void {
  const body: ApiResponse = { status: 'error', code, message, details: [] };
  res.status(status).json(body);
}

function sendNotFound(res: Response): void {
  sendError(res, 404, 'NOT_FOUND', '指定されたTODOが見つかりません');
}

// DBに接続できないエラーかどうかを判定する
function isDbUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== 'string') return false;
  return (
    ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code) ||
    code.startsWith('08') || // PostgreSQL: connection_exception
    code === '57P01' // PostgreSQL: admin_shutdown
  );
}

// 予期せぬエラーを500/503に振り分ける（詳細はログのみに出力する）
function handleServerError(res: Response, error: unknown, logMessage: string): void {
  console.error(logMessage, error);
  if (isDbUnavailable(error)) {
    sendError(res, 503, 'DB_UNAVAILABLE', 'データベースに接続できませんでした');
  } else {
    sendError(res, 500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
  }
}

// パスパラメータのIDを1以上の整数に変換する（不正な場合はnull）
function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  return Number(value);
}


// ------------------------------
// API（index.tsで /api/v1/todos にマウントされる）
// ------------------------------
todoRouter.use(express.json()); // JSON形式のリクエスト本文を受け取れるようにする

// REQ-01: 一覧取得
todoRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const todos = await todoService.getAll();
    const body: ApiResponse<Todo[]> = { status: 'success', data: todos };
    res.status(200).json(body);
  } catch (error) {
    handleServerError(res, error, 'TODO一覧の取得に失敗しました');
  }
});

// REQ-02: 新規登録
todoRouter.post('/', async (req: Request, res: Response) => {
  const title: unknown = req.body?.title;
  if (typeof title !== 'string') {
    sendError(res, 400, 'BAD_REQUEST', 'titleを文字列で指定してください');
    return;
  }

  const trimmedTitle = title.trim();
  const length = [...trimmedTitle].length; // 絵文字などを1文字として数える
  if (length < 1 || length > TITLE_MAX_LENGTH) {
    sendError(res, 422, 'VALIDATION_ERROR', `タイトルは1文字以上${TITLE_MAX_LENGTH}文字以内で入力してください`);
    return;
  }

  try {
    const todo = await todoService.create(trimmedTitle);
    const body: ApiResponse<Todo> = { status: 'success', data: todo };
    res.status(201).json(body);
  } catch (error) {
    handleServerError(res, error, 'TODOの登録に失敗しました');
  }
});

// REQ-03: 完了状態の更新
todoRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください');
    return;
  }

  const isCompleted: unknown = req.body?.isCompleted;
  if (typeof isCompleted !== 'boolean') {
    sendError(res, 400, 'BAD_REQUEST', 'isCompletedを真偽値で指定してください');
    return;
  }

  if (id > PG_INTEGER_MAX) {
    sendNotFound(res);
    return;
  }

  try {
    const todo = await todoService.updateStatus(id, isCompleted);
    if (!todo) {
      sendNotFound(res);
      return;
    }
    const body: ApiResponse<Todo> = { status: 'success', data: todo };
    res.status(200).json(body);
  } catch (error) {
    handleServerError(res, error, 'TODOの更新に失敗しました');
  }
});

// REQ-04: 削除
todoRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください');
    return;
  }

  if (id > PG_INTEGER_MAX) {
    sendNotFound(res);
    return;
  }

  try {
    const deleted = await todoService.delete(id);
    if (!deleted) {
      sendNotFound(res);
      return;
    }
    res.status(204).end();
  } catch (error) {
    handleServerError(res, error, 'TODOの削除に失敗しました');
  }
});

// JSONの構文エラーなどを標準エラーフォーマットで返す
todoRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError || (error as { type?: unknown })?.type === 'entity.parse.failed') {
    sendError(res, 400, 'BAD_REQUEST', 'リクエスト本文のJSONが不正です');
    return;
  }
  handleServerError(res, error, 'TODO APIで予期せぬエラーが発生しました');
});

export default todoRouter;
