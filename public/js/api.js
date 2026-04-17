var API_BASE = '/api';


function getToken() {
    var token = localStorage.getItem('bl_token');
    return token;
}

function setToken(token) {
    localStorage.setItem('bl_token', token);
}

function removeToken() {
    localStorage.removeItem('bl_token');
}

function getHeaders() {
    var token = getToken();
    if (token) {
        return {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        };
    }
    return {
        'Content-Type': 'application/json'
    };
}


function getSession() {
    try {
        var stored = localStorage.getItem('bl_user');
        var user = JSON.parse(stored);
        return user;
    } catch (error) {
        return null;
    }
}

function setSession(user) {
    var userAsString = JSON.stringify(user);
    localStorage.setItem('bl_user', userAsString);
}

function removeSession() {
    localStorage.removeItem('bl_user');
}


async function request(method, path, body, needsAuth) {
    if (needsAuth === undefined) {
        needsAuth = true;
    }
    var headers;
    if (needsAuth) {
        headers = getHeaders();
    } else {
        headers = { 'Content-Type': 'application/json' };
    }
    var options = {
        method: method,
        headers: headers
    };
    if (body !== null && body !== undefined) {
        options.body = JSON.stringify(body);
    }
    var response = await fetch(API_BASE + path, options);
    if (response.status === 204) {
        return null;
    }
    var data = await response.json();
    if (!response.ok) {
        if (response.status === 401 && !path.startsWith('/auth/')) {
            removeToken();
            removeSession();
            if (typeof showView === 'function') {
                showView('auth');
            } else {
                window.location.hash = '#auth';
            }
        }
        var errorMessage = data.detail || 'Serverfehler.';
        throw new Error(errorMessage);
    }
    return data;
}


var Auth = {
    signin: async function(username, password, name) {
        var userData = {
            username: username,
            password: password,
            name: name
        };
        var data = await request('POST', '/auth/signin', userData, false);
        setToken(data.token);
        setSession(data.user);
        return data.user;
    },

    login: async function(username, password) {
        var userData = {
            username: username,
            password: password
        };
        var data = await request('POST', '/auth/login', userData, false);
        setToken(data.token);
        setSession(data.user);
        return data.user;
    },

    logout: function() {
        removeToken();
        removeSession();
    },

    current: function() {
        return getSession();
    },

    isLoggedIn: function() {
        var token = getToken();
        var session = getSession();
        if (token && session) {
            return true;
        }
        return false;
    }
};


var Beers = {
    getAll: function() {
        return request('GET', '/beers');
    },
    getById: function(id) {
        return request('GET', '/beers/' + id);
    },
    create: function(beerData) {
        return request('POST', '/beers', beerData);
    },
    update: function(id, beerData) {
        return request('PUT', '/beers/' + id, beerData);
    },
    delete: function(id) {
        return request('DELETE', '/beers/' + id);
    },
    stats: function() {
        return request('GET', '/stats/summary');
    }
};


var Styles = {
    getAll: function() {
        return request('GET', '/styles');
    },
    add: function(name) {
        return request('POST', '/styles', { name: name });
    }
};


var Router = {
    go: function(view) {
        if (typeof showView === 'function') {
            showView(view);
        } else {
            window.location.hash = '#' + view;
        }
    }
};
