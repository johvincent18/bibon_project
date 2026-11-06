// If someone is already logged in, go straight to the dashboard
if (getToken()) {
  api('/auth/me').then(() => location.replace('index.html')).catch(() => {});
}

showFlash();

function shake() {
  const card = document.querySelector('.auth-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

// Show / hide password buttons
document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-pressed', String(show));
  });
});

// ---------- LOGIN ----------
const loginForm = $('loginForm');
if (loginForm) {
  const email = flashTake('cellhubEmail');
  if (email) {
    $('loginEmail').value = email;
    $('loginPassword').focus();
  }
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runForm(loginForm, async () => {
      try {
        const data = await api('/auth/login', {
          method: 'POST',
          noAuth: true,
          body: JSON.stringify({
            email: $('loginEmail').value,
            password: $('loginPassword').value,
          }),
        });
        setToken(data.token);
        flash('Welcome, ' + data.user.name + '!', false);
        goTo('index.html');
      } catch (err) {
        shake();
        throw err;
      }
    });
  });
}

// ---------- REGISTER ----------
const registerForm = $('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runForm(registerForm, async () => {
      try {
        if ($('regPassword').value !== $('regConfirm').value) {
          throw new Error('The two passwords do not match.');
        }
        const user = await api('/auth/register', {
          method: 'POST',
          noAuth: true,
          body: JSON.stringify({
            name: $('regName').value,
            email: $('regEmail').value,
            password: $('regPassword').value,
          }),
        });
        flash('Account created. Now sign in with your email and password.', false);
        flashSet('cellhubEmail', user.email);
        goTo('login.html');
      } catch (err) {
        shake();
        throw err;
      }
    });
  });
}