var AuthView = {
    currentTab: 'login',

    switchTab: function(tab) {
        AuthView.currentTab = tab;
        var isSignin = (tab === 'signin');
        document.getElementById('tab-login').classList.toggle('active', !isSignin);
        document.getElementById('tab-signin').classList.toggle('active', isSignin);
        if (isSignin) {
            document.getElementById('field-name').style.display    = 'block';
            document.getElementById('field-confirm').style.display = 'block';
            document.getElementById('label-password').textContent  = 'Passwort * (mind. 6 Zeichen)';
            document.getElementById('auth-submit-btn').textContent = 'Registrieren →';
            document.getElementById('footer-text').textContent     = 'Bereits registriert?';
            document.getElementById('footer-link').textContent     = 'Zum Login';
            document.getElementById('footer-link').onclick = function() { AuthView.switchTab('login'); };
        } else {
            document.getElementById('field-name').style.display    = 'none';
            document.getElementById('field-confirm').style.display = 'none';
            document.getElementById('label-password').textContent  = 'Passwort *';
            document.getElementById('auth-submit-btn').textContent = 'Anmelden →';
            document.getElementById('footer-text').textContent     = 'Noch kein Account?';
            document.getElementById('footer-link').textContent     = 'Jetzt registrieren';
            document.getElementById('footer-link').onclick = function() { AuthView.switchTab('signin'); };
        }
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-form').reset();
    },

    togglePass: function(inputId, button) {
        var input    = document.getElementById(inputId);
        var isHidden = (input.style.webkitTextSecurity === 'disc');
        input.style.webkitTextSecurity = isHidden ? 'none' : 'disc';
        button.textContent = isHidden ? '🙈' : '👁';
    },

    handleSubmit: async function(event) {
        event.preventDefault();
        var errorEl  = document.getElementById('auth-error');
        errorEl.style.display = 'none';
        var username = document.getElementById('input-username').value.trim();
        var password = document.getElementById('input-password').value;
        var name     = document.getElementById('input-name').value.trim();
        var confirm  = document.getElementById('input-confirm').value;
        var button   = document.getElementById('auth-submit-btn');
        if (!username) { AuthView._err(errorEl, 'Benutzername ist erforderlich.'); return; }
        if (!password) { AuthView._err(errorEl, 'Passwort ist erforderlich.'); return; }
        if (AuthView.currentTab === 'signin') {
            if (!name)               { AuthView._err(errorEl, 'Bitte gib deinen Namen ein.'); return; }
            if (username.length < 3) { AuthView._err(errorEl, 'Benutzername muss mindestens 3 Zeichen haben.'); return; }
            if (password.length < 6) { AuthView._err(errorEl, 'Passwort muss mindestens 6 Zeichen haben.'); return; }
            if (password !== confirm) { AuthView._err(errorEl, 'Passwörter stimmen nicht überein.'); return; }
        }
        button.disabled     = true;
        button.textContent  = 'Bitte warten...';
        try {
            if (AuthView.currentTab === 'login') {
                await Auth.login(username, password);
            } else {
                await Auth.signin(username, password, name);
            }
            Router.go('dashboard');
        } catch (error) {
            AuthView._err(errorEl, error.message || 'Fehler beim Anmelden.');
        } finally {
            button.disabled    = false;
            button.textContent = AuthView.currentTab === 'login' ? 'Anmelden →' : 'Registrieren →';
        }
    },

    _err: function(el, msg) {
        el.textContent    = '⚠ ' + msg;
        el.style.display  = 'block';
    }
};
