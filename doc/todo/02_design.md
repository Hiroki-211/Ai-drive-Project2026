# TODOアプリ V1 設計書

## 1 作るものとファイルの役割

本設計書は、要件定義書（`01_requirements.md`）に基づき、既存の Express + TypeScript + EJS アプリケーションに対して TODO管理機能（画面 `/todo` および REST API `/api/v1/todos`）を追加するための設計仕様である。

### ファイル構成

```text
 project-root/
 ├── src/
 │   ├── index.ts                   # エントリポイント（todoRouterの登録のみ追記）
 │   ├── db.ts                      # 既存のDB接続モジュール【要確認】
 │   └── apps/
 │       └── todo/                  # TODOアプリ専用モジュール
 │           ├── todoRouter.ts      # APIルーター (Express Router)
 │           ├── todoService.ts     # DB操作・ビジネスロジック層
 │           ├── todoViewRouter.ts  # 【要確認】画面用ルーター (/todo 表示用)
 │           └── types.ts           # 型定義 (Todo, ApiRequest, ApiResponse等)
 ├── views/
 │   └── todo/
 │       └── index.ejs              # TODO管理画面テンプレート
 ├── public/
 │   └── todo/
 │       └── todoApi.js             # クライアント用 API クラス (Fetch API wrappers) 【要確認】
 ├── sql/
 │   └── todo/
 │       └── create_table.sql       # todo_tasks テーブル作成DDL
 └── docs/
     └── todo/
         ├── 01_requirements.md     # 要件定義書
         └── 02_design.md           # 本設計書
```

---

## 2 リクエストはどこを通るか

```text
[ Client (Browser) ]
       │
       ├─ (1) GET /todo ───────────────────► [ todoViewRouter.ts ] ──► [ views/todo/index.ejs ]
       │
       └─ (2) /api/v1/todos (Fetch API) ──► [ index.ts ] 
                                                  │
                                                  ▼
                                          [ todoRouter.ts ]
                                                  │
                                                  ▼
                                         [ todoService.ts ]
                                                  │
                                                  ▼
                                       [ DB (Neon PostgreSQL) ]
```

1. **画面表示**: `/todo` へのアクセスを受け取った `todoViewRouter.ts`【要確認】が `views/todo/index.ejs` をレンダリングして初期画面を返します。
2. **非同期操作**: 画面上の操作に応じ、クライアント側の `public/todo/todoApi.js` から `/api/v1/todos` へ非同期リクエストを発行します。
3. **APIルーティング**: `index.ts` 内でマウントされた `todoRouter.ts` がリクエストを判定し、`todoService.ts` を経由して PostgreSQL（Neon）へアクセスのうえ、JSON形式で結果を返却します。

---

## 3 DBの設計

既存の Neon PostgreSQL 内に `todo_tasks` テーブルを作成します。

### 3.1 テーブル定義 (`todo_tasks`)

| カラム名 (snake_case) | 型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY GENERATED ALWAYS AS IDENTITY` | 自動採番ID |
| `title` | `TEXT` | `NOT NULL` | タスク名（トリム後1〜100文字） |
| `is_completed` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | 完了フラグ |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | 作成日時 |

### 3.2 テーブル作成 SQL (`sql/todo/create_table.sql`)

```sql
CREATE TABLE IF NOT EXISTS todo_tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4 APIの共通ルール

### 4.1 キャメルケースとスネークケースの相互変換

* **データベース層 (`todo_tasks`)**: `snake_case` (`id`, `title`, `is_completed`, `created_at`)
* **API / JSON層**: `camelCase` (`id`, `title`, `isCompleted`, `createdAt`)

### 4.2 レスポンス形式の標準化

* **成功時 (200 / 201)**: `{"status": "success", "data": ...}`
* **成功時 (204)**: 本文なし (No Content)
* **エラー時 (4xx / 5xx)**: `{"status": "error", "code": "...", "message": "...", "details": []}`

---

## 5 4機能（API設計一覧）

### 5.1 REQ-01: 一覧取得 (GET)

| 項目 | 内容 |
| :--- | :--- |
| **参照要件** | `REQ-01` |
| **HTTPメソッド / URL** | `GET /api/v1/todos` |
| **リクエスト本文** | なし |
| **成功ステータス** | `200 OK` |
| **失敗ステータス** | `500 INTERNAL_ERROR`, `503 DB_UNAVAILABLE` |
| **成功時 JSON 例** | `{"status":"success","data":[{"id":1,"title":"サンプルTODO","isCompleted":false,"createdAt":"2026-10-28T06:00:00.000Z"}]}` |
| **失敗時 JSON 例** | `{"status":"error","code":"DB_UNAVAILABLE","message":"データベースに接続できませんでした","details":[]}` |
| **DB処理** | `SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id DESC;` |
| **TodoApi メソッド** | `getAll(): Promise<Todo[]>` |
| **確認方法** | ブラウザで `/todo` 表示時または Fetch で `GET /api/v1/todos` を実行し、一覧配列を取得できるか（0件時は `[]` が返るか）確認。 |

---

### 5.2 REQ-02: 新規登録 (POST)

| 項目 | 内容 |
| :--- | :--- |
| **参照要件** | `REQ-02` |
| **HTTPメソッド / URL** | `POST /api/v1/todos` |
| **リクエスト本文** | `{"title": "新しいTODO"}` |
| **成功ステータス** | `201 Created` (または `200 OK`) |
| **失敗ステータス** | `400 BAD_REQUEST`, `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR`, `503 DB_UNAVAILABLE` |
| **成功時 JSON 例** | `{"status":"success","data":{"id":2,"title":"新しいTODO","isCompleted":false,"createdAt":"2026-10-28T06:10:00.000Z"}}` |
| **失敗時 JSON 例** | `{"status":"error","code":"VALIDATION_ERROR","message":"タイトルは1文字以上100文字以内で入力してください","details":[]}` |
| **DB処理** | `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed, created_at;` |
| **TodoApi メソッド** | `create(title: string): Promise<Todo>` |
| **確認方法** | フォームから1文字、100文字を入力して登録成功を確認。空文字や101文字以上で422エラーが返ることを確認。 |

---

### 5.3 REQ-03: 完了状態変更 (PATCH)

| 項目 | 内容 |
| :--- | :--- |
| **参照要件** | `REQ-03` |
| **HTTPメソッド / URL** | `PATCH /api/v1/todos/:id` |
| **リクエスト本文** | `{"isCompleted": true}` |
| **成功ステータス** | `200 OK` |
| **失敗ステータス** | `400 BAD_REQUEST`, `404 NOT_FOUND`, `500 INTERNAL_ERROR`, `503 DB_UNAVAILABLE` |
| **成功時 JSON 例** | `{"status":"success","data":{"id":2,"title":"新しいTODO","isCompleted":true,"createdAt":"2026-10-28T06:10:00.000Z"}}` |
| **失敗時 JSON 例** | `{"status":"error","code":"NOT_FOUND","message":"指定されたTODOが見つかりません","details":[]}` |
| **DB処理** | `UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at;` |
| **TodoApi メソッド** | `updateStatus(id: number, isCompleted: boolean): Promise<Todo>` |
| **確認方法** | チェックボックス操作で状態変更が反映されるか確認。存在しないID（9999等）へのリクエストで404エラーを確認。 |

---

### 5.4 REQ-04: 削除 (DELETE)

| 項目 | 内容 |
| :--- | :--- |
| **参照要件** | `REQ-04` |
| **HTTPメソッド / URL** | `DELETE /api/v1/todos/:id` |
| **リクエスト本文** | なし |
| **成功ステータス** | `204 No Content` |
| **失敗ステータス** | `400 BAD_REQUEST`, `404 NOT_FOUND`, `500 INTERNAL_ERROR`, `503 DB_UNAVAILABLE` |
| **成功時 JSON 例** | レスポンスボディなし |
| **失敗時 JSON 例** | `{"status":"error","code":"NOT_FOUND","message":"指定されたTODOが見つかりません","details":[]}` |
| **DB処理** | `DELETE FROM todo_tasks WHERE id = $1 RETURNING id;` |
| **TodoApi メソッド** | `delete(id: number): Promise<void>` |
| **確認方法** | 削除ボタン押下で204が返り一覧から消えるか確認。不正なID文字列や存在しないIDで400/404エラーを確認。 |

---

## 6 画面とTodoApiの設計

### 6.1 `TodoApi` クラス（`public/todo/todoApi.js`）

```javascript
export class TodoApi {
  constructor(baseUrl = '/api/v1/todos') {
    this.baseUrl = baseUrl;
  }

  async getAll() {
    const res = await fetch(this.baseUrl);
    const json = await res.json();
    if (!res.ok) throw json;
    return json.data;
  }

  async create(title) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (!res.ok) throw json;
    return json.data;
  }

  async updateStatus(id, isCompleted) {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted }),
    });
    const json = await res.json();
    if (!res.ok) throw json;
    return json.data;
  }

  async delete(id) {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw json;
    }
  }
}
```

---

## 7 エラーはどこで処理するか

1. **ルーター層 (`src/apps/todo/todoRouter.ts`)**:
   * リクエストパラメータ・本文のバリデーションチェック。
   * 入力不正時の `400 BAD_REQUEST` / `422 VALIDATION_ERROR` レスポンス生成。
   * トライキャッチによる全体の例外捕捉。
2. **サービス層 (`src/apps/todo/todoService.ts`)**:
   * SQLクエリ実行時の失敗（`500 INTERNAL_ERROR`）の検知。
   * 対象データが存在しない場合の `404 NOT_FOUND` 判定。
3. **DBモジュール**:
   * DBサーバー非導通時の `503 DB_UNAVAILABLE` 例外送出。

---

## 8 実装への注意事項

### 8.1 `index.ts` への追記位置

`index.ts` への変更は最小限に抑え、既存のTOPルートやDBチェックルーティングを保持したまま `todoRouter` を追加します。

```typescript
import express from 'express';
// ... 既存のインポート
import todoRouter from './apps/todo/todoRouter'; // 追加

const app = express();

app.use(express.json());
app.use(express.static('public'));

// 既存のルート定義 (維持)
// app.get('/', ...);
// app.get('/api/db-check', ...);

// TODO APIルーターの登録 (最小限の追記)
app.use('/api/v1/todos', todoRouter);

// ... サーバー起動処理
```

---

## 9 曖昧・未確定点（要確認事項）

以下の点については確定していないため、**要確認**として列挙します。

1. **`/todo` 画面ルーティングの定義場所【要確認】**:
   * `/todo` 画面を表示するための GET ルーターを `src/apps/todo/todoViewRouter.ts` として切り出すか、あるいは `index.ts` 直下に `app.get('/todo', ...)` を追加するかの構成。
2. **`public/todo/todoApi.js` のビルド／配備形式【要確認】**:
   * クライアントサイドJavaScriptは `public/todo/todoApi.js` として生JS（ES Module）で配置するか、TypeScriptからビルドして配置する手順にするか。
3. **既存のDB接続インスタンスのファイルパス【要確認】**:
   * 既存のDB接続モジュール（Pool / Client）が `src/db.ts` や `src/db/index.ts` 等のどこに存在し、どのようなオブジェクト名（`pool`, `db`, `query` 等）でエクスポートされているか。
```

---

### 次のステップに関するご質問

設計書の構成やディレクトリ構造について、修正や追加のご要望はございますか？
特に**要確認事項（`/todo` 画面ルーターの定義位置、DB接続モジュールのファイルパス、クライアントJSのビルド仕様）**についてご指示をいただければ、速やかに反映いたします。