var VIEWS = ['auth', 'dashboard', 'add'];

var Router = {
    go: function(name) {
        if ((name === 'dashboard' || name === 'add') && !Auth.isLoggedIn()) {
            name = 'auth';
        }
        if (name === 'auth' && Auth.isLoggedIn()) {
            name = 'dashboard';
        }
        for (var i = 0; i < VIEWS.length; i++) {
            var el = document.getElementById('view-' + VIEWS[i]);
            if (el) el.classList.remove('active');
        }
        var target = document.getElementById('view-' + name);
        if (target) target.classList.add('active');
        history.pushState(null, '', '#' + name);
        var titles = {
            auth:      'BierLog – Anmelden',
            dashboard: 'BierLog – Dashboard',
            add:       'BierLog – Bier hinzufügen'
        };
        document.title = titles[name] || 'BierLog';
        if (name === 'dashboard') DashboardView.init();
        if (name === 'add')       AddBierView.init();
    }
};

window.addEventListener('popstate', function() {
    Router.go(window.location.hash.replace('#', ''));
});

window.addEventListener('DOMContentLoaded', function() {
    var hash = window.location.hash.replace('#', '');
    if (VIEWS.indexOf(hash) !== -1) {
        Router.go(hash);
    } else if (Auth.isLoggedIn()) {
        Router.go('dashboard');
    } else {
        Router.go('auth');
    }
});
