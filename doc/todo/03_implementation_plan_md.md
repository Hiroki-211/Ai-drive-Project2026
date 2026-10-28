# TODO機能 実装計画書 (03_implementation_plan.md)

本計画書は、`01_requirements.md` および `02_design.md` に基づき、既存の Express + TypeScript + EJS アプリケーションに対して TODO 管理機能を安全かつ段階的に追加するための作業手順書です。

---

## 前提条件と留意事項

1. **既存ルートの保護**: `GET /` および `GET /api/db-check` などの既存機能を決して壊さないように進めます。
2. **既存DBモジュールの再利用**: 既存の `src/db.ts`（`pg.Pool` インスタンス等をエクスポート）を利用します。
3. **安全な変更手順**: 各工程でファイル作成・変更・確認コマンド・失敗時の確認ポイントを明記し、安全に進行します。

---

## 全体進捗チェックリスト

- [ ] Step 1: DDLファイルの作成とGit保存（リポジトリ管理）
- [ ] Step 2: Neon SQL Editor での DDL 手動実行（DB変更）
- [ ] Step 3: 型定義ファイルの作成 (`src/apps/todo/types.ts`)
- [ ] Step 4: サービス層の実装 (`src/apps/todo/todoService.ts`)
- [ ] Step 5: APIルーターの実装 (`src/apps/todo/todoRouter.ts`)
- [ ] Step 6: 画面表示ルーターの実装 (`src/apps/todo/todoViewRouter.ts`)
- [ ] Step 7: エントリポイントの更新 (`src/index.ts`)
- [ ] Step 8: EJS画面テンプレートの作成 (`views/todo/index.ejs`)
- [ ] Step 9: クライアントAPIクラスの作成 (`public/todo/todoApi.js`)
- [ ] Step 10: 全体動作検証（E2E / 手動シナリオ確認）

---

## 作業工程詳細

### Step 1: DDLファイルの作成とGit保存
* **目的**: データベース構造をソースコード管理（Git）に含めるため、SQLファイルをローカルに保存します。

* **対象ファイル**: `sql/todo/create_table.sql`
* **作業内容**:
  以下の内容でファイルを作成します。
  ```sql
  CREATE TABLE IF NOT EXISTS todo_tasks (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
* **確認コマンド**:
  ```bash
  ls -la sql/todo/create_table.sql
  ```
* **期待結果**: ファイルが存在し、記述されたSQL文が正常に保存されていること。
* **失敗時に最初に見る場所**: `sql/todo` ディレクトリが存在するか確認（存在しない場合は `mkdir -p sql/todo` を実行）。

---

### Step 2: Neon SQL Editorでの DDL 手動実行
* **目的**: 開発用・検証用の Neon PostgreSQL データベースに `todo_tasks` テーブルを作成します。

* **対象作業**: ブラウザで Neon Console (SQL Editor) を開いて実行
* **作業内容**:
  1. Neon Dashboard にログインし、対象プロジェクトの SQL Editor を開く。
  2. `sql/todo/create_table.sql` の中身を貼り付けて実行 (`Run`)。
* **確認コマンド** (Neon SQL Editor上で実行):
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_name = 'todo_tasks';
  ```
* **期待結果**: `todo_tasks` の1行が結果として返却されること。
* **失敗時に最初に見る場所**:
  - 接続先データベース（`DATABASE_URL`）のプロジェクト・ブランチが一致しているか。
  - SQL文のタイポや権限エラーログがないか。

---

### Step 3: 型定義ファイルの作成
* **目的**: バックエンド・APIレスポンス等で利用する型定義を作成します。

* **対象ファイル**: `src/apps/todo/types.ts`
* **作業内容**:
  以下のインターフェースと型を定義します。
  ```typescript
  export interface Todo {
    id: number;
    title: string;
    isCompleted: boolean;
    createdAt: string;
  }

  export interface DbTodoRow {
    id: number;
    title: string;
    is_completed: boolean;
    created_at: Date;
  }

  export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    code?: string;
    message?: string;
    details?: any[];
  }
  ```
* **確認コマンド**:
  ```bash
  npx tsc --noEmit
  ```
* **期待結果**: TypeScriptのコンパイルエラーが出力されないこと。
* **失敗時に最初に見る場所**: インポート/エクスポート構文の誤りやタイポ。

---

### Step 4: サービス層の実装
* **目的**: DBクエリの発行と、`snake_case` $\leftrightarrow$ `camelCase` への相互変換を行うロジックを実装します。

* **対象ファイル**: `src/apps/todo/todoService.ts`
* **作業内容**:
  `src/db.ts` を読み込み、`todo_tasks` に対する CRUD 処理を行う `TodoService` を作成します。
  ```typescript
  import { pool } from '../../db'; // 既存のdb.tsからエクスポートされているpoolを利用
  import { Todo, DbTodoRow } from './types';

  export class TodoService {
    private static mapToTodo(row: DbTodoRow): Todo {
      return {
        id: row.id,
        title: row.title,
        isCompleted: row.is_completed,
        createdAt: row.created_at.toISOString(),
      };
    }

    async getAll(): Promise<Todo[]> {
      const res = await pool.query<DbTodoRow>(
        'SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id DESC;'
      );
      return res.rows.map(TodoService.mapToTodo);
    }

    async create(title: string): Promise<Todo> {
      const res = await pool.query<DbTodoRow>(
        'INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed, created_at;',
        [title]
      );
      return TodoService.mapToTodo(res.rows[0]);
    }

    async updateStatus(id: number, isCompleted: boolean): Promise<Todo | null> {
      const res = await pool.query<DbTodoRow>(
        'UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at;',
        [isCompleted, id]
      );
      if (res.rows.length === 0) return null;
      return TodoService.mapToTodo(res.rows[0]);
    }

    async delete(id: number): Promise<boolean> {
      const res = await pool.query<DbTodoRow>(
        'DELETE FROM todo_tasks WHERE id = $1 RETURNING id;',
        [id]
      );
      return res.rows.length > 0;
    }
  }
  ```
* **確認コマンド**:
  ```bash
  npx tsc --noEmit
  ```
* **期待結果**: 型チェックを通過すること。
* **失敗時に最初に見る場所**: `src/db.ts` からエクスポートされているオブジェクト名（`pool` か `db` か等）。

---

### Step 5: APIルーターの実装
* **目的**: REST API (`/api/v1/todos`) のバリデーションおよびレスポンス制御を実装します。

* **対象ファイル**: `src/apps/todo/todoRouter.ts`
* **作業内容**:
   Express Router を初期化し、4つの要件（REQ-01〜04）に応じたエンドポイントを実装します。
  - `GET /` : 一覧取得
  - `POST /` : 入力文字数（1〜100文字）検証の上、新規追加
  - `PATCH /:id` : IDおよび `isCompleted` の検証の上、更新
  - `DELETE /:id` : ID検証の上、削除（成功時 204）
* **確認コマンド**:
  ```bash
  npx tsc --noEmit
  ```
* **期待結果**: 型エラーが発生しないこと。
* **失敗時に最初に見る場所**: `express.Router()` の定義やレスポンスオブジェクトの形式 (`ApiResponse`)。

---

### Step 6: 画面表示ルーターの実装
* **目的**: 画面 `/todo` のレンダリングを担うルーターを作成します。

* **対象ファイル**: `src/apps/todo/todoViewRouter.ts`
* **作業内容**:
  ```typescript
  import { Router } from 'express';

  const todoViewRouter = Router();

  todoViewRouter.get('/', (req, res) => {
    res.render('todo/index');
  });

  export default todoViewRouter;
  ```
* **確認コマンド**:
  ```bash
  npx tsc --noEmit
  ```
* **期待結果**: エラーなくコンパイルできること。
* **失敗時に最初に見る場所**: モジュールのインポート/エクスポートパス。

---

### Step 7: エントリポイントの更新
* **目的**: 作成したルーターを既存の `src/index.ts` に追加登録します。既存のルート定義（`/` や `/api/db-check`）には変更を加えません。

* **対象ファイル**: `src/index.ts`
* **作業内容**:
  1. `todoRouter` と `todoViewRouter` をインポート。
  2. ルーティングの登録を追記:
     ```typescript
     import todoRouter from './apps/todo/todoRouter';
     import todoViewRouter from './apps/todo/todoViewRouter';

     // 既存コード保持 ...

     app.use('/todo', todoViewRouter);
     app.use('/api/v1/todos', todoRouter);
     ```
* **確認コマンド**:
  ```bash
  npm run dev
  ```
* **期待結果**:
  - サーバーがエラーなく起動すること。
  - 既存の `GET /` や `GET /api/db-check` にアクセスして正常応答すること。
* **失敗時に最初に見る場所**: `npm run dev` 実行時のコンソールエラーログ（ミドルウェア順序やインポートミス）。

---

### Step 8: EJS画面テンプレートの作成
* **目的**: `/todo` 画面のHTMLレイアウトを作成します。

* **対象ファイル**: `views/todo/index.ejs`
* **作業内容**:
  TODO入力フォーム、TODO一覧表示領域、JavaScriptファイル (`/todo/todoApi.js`) の読み込みを記述した EJS テンプレートを作成します。
* **確認コマンド**:
  ブラウザで `http://localhost:3000/todo` にアクセス。
* **期待結果**: TODO画面の基本レイアウトが表示されること（500 View Error 等にならないこと）。
* **失敗時に最初に見る場所**: `views/` のパス指定、Express の view engine 設定 (`app.set('view engine', 'ejs')`)。

---

### Step 9: クライアントAPIクラスと画面ロジックの作成
* **目的**: クライアントサイドでの Fetch API 呼び出しロジックおよびDOM操作を実装します。

* **対象ファイル**: `public/todo/todoApi.js`
* **作業内容**:
  - `TodoApi` クラス（`getAll`, `create`, `updateStatus`, `delete`）を実装。
  - 画面読み込み時に `getAll()` を呼び出して一覧を描画。
  - 登録・チェックボックス切り替え・削除イベントをハンドル。
* **確認コマンド**:
  ブラウザのディベロッパーツールの Console および Network タブを開き、操作を実施。
* **期待結果**:
  - Fetch リクエストが `/api/v1/todos` に対して発行されること。
  - 画面のDOMがリアルタイムに更新されること。
* **失敗時に最初に見る場所**:
  - ブラウザコンソールの JS エラー。
  - Express の静的ファイル設定 (`app.use(express.static('public'))`)。

---

### Step 10: 全体動作検証 (E2E / エラー系動作確認)

* **目的**: 要件定義書（`01_requirements.md`）に記載された全受け入れ条件を満たしているかテストします。

* **確認手順**:
  1. **REQ-01 (一覧)**: 画面ロード時に最新TODOが取得されるか。全削除時に空配列になっても崩れないか。
  2. **REQ-02 (登録)**:
     - 1文字、100文字で正常登録されるか。
     - 0文字、101文字以上で `422 VALIDATION_ERROR` が返り、画面にエラーが表示されるか。
  3. **REQ-03 (更新)**: チェックボックスを切り替えた際に `PATCH /api/v1/todos/:id` が走り、DBの `is_completed` が更新されるか。
  4. **REQ-04 (削除)**: 削除ボタンで `DELETE /api/v1/todos/:id` (204) が走り、画面から削除されるか。
* **確認コマンド**:
  ```bash
  # API単体テスト（cURL例）
  curl -X GET http://localhost:3000/api/v1/todos
  curl -X POST http://localhost:3000/api/v1/todos -H "Content-Type: application/json" -d '{"title":"テストタスク"}'
  ```
* **期待結果**: すべての機能が設計通りのステータスコードとフォーマットで動作すること。
* **失敗時に最初に見る場所**: サーバーコンソールログ、HTTPレスポンスの `code` と `message`。