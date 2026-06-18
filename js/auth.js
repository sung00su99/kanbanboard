document.addEventListener('DOMContentLoaded', async () => {
  // 이미 로그인된 경우 보드로 이동
  try {
    await api.me();
    location.href = 'board.html';
    return;
  } catch (_) { /* 미로그인 상태 */ }

  const loginTab   = document.getElementById('login-tab');
  const signupTab  = document.getElementById('signup-tab');
  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginMsg   = document.getElementById('login-msg');
  const signupMsg  = document.getElementById('signup-msg');

  function showTab(tab) {
    const isLogin = tab === 'login';
    loginTab.classList.toggle('active', isLogin);
    signupTab.classList.toggle('active', !isLogin);
    loginForm.classList.toggle('active', isLogin);
    signupForm.classList.toggle('active', !isLogin);
    loginMsg.textContent = '';
    signupMsg.textContent = '';
  }

  loginTab.addEventListener('click',  () => showTab('login'));
  signupTab.addEventListener('click', () => showTab('signup'));

  // 로그인
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMsg.className = 'form-message';
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      await api.login({ username, password });
      location.href = 'board.html';
    } catch (err) {
      loginMsg.textContent = err.message;
    }
  });

  // 회원가입
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupMsg.className = 'form-message';
    const name     = document.getElementById('signup-name').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm  = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      signupMsg.textContent = '비밀번호가 일치하지 않습니다.';
      return;
    }
    try {
      await api.signup({ name, username, password });
      signupMsg.className = 'form-message ok';
      signupMsg.textContent = '회원가입이 완료되었습니다. 로그인해주세요.';
      document.getElementById('login-username').value = username;
      showTab('login');
    } catch (err) {
      signupMsg.textContent = err.message;
    }
  });
});
