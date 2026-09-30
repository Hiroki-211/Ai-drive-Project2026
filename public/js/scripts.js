const button = document.getElementById('messageButton');
const message = document.getElementById('message');


button.addEventListener('click', () => {
  message.textContent = 'JavaScriptが動作しました！';
});