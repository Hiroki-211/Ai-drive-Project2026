// ------------------------------
// APIクラス（/api/v1/todos をFetch APIで操作する）
// ------------------------------
export class TodoApi {
  constructor(baseUrl = '/api/v1/todos') {
    this.baseUrl = baseUrl;
  }

  async getAll() {
    const res = await fetch(this.baseUrl);
    return this.handleResponse(res);
  }

  async create(title) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return this.handleResponse(res);
  }

  async updateStatus(id, isCompleted) {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted }),
    });
    return this.handleResponse(res);
  }

  async delete(id) {
    const res = await fetch(`${this.baseUrl}/${id}`, { method: 'DELETE' });
    return this.handleResponse(res);
  }

  // 成功時はdataを返し、失敗時はエラーメッセージを持つErrorを投げる
  async handleResponse(res) {
    if (res.status === 204) return null; // 削除成功時は本文なし

    let json = null;
    try {
      json = await res.json();
    } catch {
      // JSON以外のレスポンスはエラー扱いにする
    }

    if (!res.ok || !json || json.status !== 'success') {
      throw new Error(json?.message ?? `通信に失敗しました（${res.status}）`);
    }
    return json.data;
  }
}


// ------------------------------
// 画面の処理
// ------------------------------
const api = new TodoApi();

const form = document.getElementById('todoForm');
const titleInput = document.getElementById('todoTitle');
const errorText = document.getElementById('todoError');
const list = document.getElementById('todoList');
const emptyText = document.getElementById('todoEmpty');

function showError(message) {
  errorText.textContent = message;
}

function clearError() {
  errorText.textContent = '';
}

// 一覧が0件のときだけ「TODOはまだありません」を表示する
function updateEmptyText() {
  emptyText.hidden = list.children.length > 0;
}

// TODO1件分の<li>を作成する
function createTodoItem(todo) {
  const item = document.createElement('li');
  item.className = 'todo-item';
  item.classList.toggle('is-completed', todo.isCompleted);

  const label = document.createElement('label');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.isCompleted;

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = todo.title; // textContentを使い、入力内容をHTMLとして解釈させない

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'todo-delete';
  deleteButton.textContent = '削除';

  // REQ-03: 完了状態の切り替え
  checkbox.addEventListener('change', async () => {
    clearError();
    checkbox.disabled = true;
    try {
      const updated = await api.updateStatus(todo.id, checkbox.checked);
      item.classList.toggle('is-completed', updated.isCompleted);
    } catch (error) {
      checkbox.checked = !checkbox.checked; // 失敗したら元に戻す
      showError(error.message);
    } finally {
      checkbox.disabled = false;
    }
  });

  // REQ-04: 削除
  deleteButton.addEventListener('click', async () => {
    clearError();
    deleteButton.disabled = true;
    try {
      await api.delete(todo.id);
      item.remove();
      updateEmptyText();
    } catch (error) {
      showError(error.message);
      deleteButton.disabled = false;
    }
  });

  label.append(checkbox, title);
  item.append(label, deleteButton);
  return item;
}

// REQ-01: 一覧表示
async function loadTodos() {
  clearError();
  try {
    const todos = await api.getAll();
    list.replaceChildren(...todos.map(createTodoItem));
  } catch (error) {
    showError(error.message);
  }
  updateEmptyText();
}

// REQ-02: 新規登録
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const todo = await api.create(titleInput.value);
    list.prepend(createTodoItem(todo)); // 一覧は新しい順なので先頭に追加する
    titleInput.value = '';
    updateEmptyText();
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
    titleInput.focus();
  }
});

loadTodos();
