var AddBierView = {
    rating:     3,
    submitting: false,

    init: async function() {
        AddBierView.submitting = false;
        var user = Auth.current();
        if (user) {
            document.getElementById('nav-user-add').textContent = user.name || user.username || '';
        }
        document.getElementById('add-form').style.display           = 'block';
        document.getElementById('counter-banner').style.display     = 'none';
        document.getElementById('add-error').style.display          = 'none';
        document.getElementById('add-form').reset();
        document.getElementById('add-date').value                   = new Date().toISOString().split('T')[0];
        document.getElementById('add-submit-btn').disabled          = false;
        document.getElementById('add-submit-btn').textContent       = '🍺 Speichern';
        AddBierView.rating = 3;
        document.getElementById('add-rating').value = 3;
        AddBierView._renderStars(3);
        await AddBierView._loadStyles();
        setTimeout(function() {
            document.getElementById('add-name').focus();
        }, 100);
    },

    handleSubmit: async function(event) {
        event.preventDefault();
        if (AddBierView.submitting) return;
        var errorEl = document.getElementById('add-error');
        errorEl.style.display = 'none';
        var name   = document.getElementById('add-name').value.trim();
        var origin = document.getElementById('add-origin').value.trim();
        var style  = document.getElementById('add-style').value;
        var rating = parseInt(document.getElementById('add-rating').value);
        var date   = document.getElementById('add-date').value;
        var notes  = document.getElementById('add-notes').value;
        if (!name)               { errorEl.textContent = '⚠ Name ist erforderlich.';              errorEl.style.display = 'block'; return; }
        if (!origin)             { errorEl.textContent = '⚠ Herkunft ist erforderlich.';           errorEl.style.display = 'block'; return; }
        if (style === '__new__') { errorEl.textContent = '⚠ Bitte Stil speichern oder abbrechen.'; errorEl.style.display = 'block'; return; }
        var button = document.getElementById('add-submit-btn');
        AddBierView.submitting = true;
        button.disabled    = true;
        button.textContent = 'Speichern...';
        try {
            var result = await Beers.create({ name: name, origin: origin, style: style, rating: rating, date: date, notes: notes });
            if (result._incremented) {
                document.getElementById('counter-text').innerHTML =
                    '<strong>' + result.name + '</strong> existiert bereits. Zähler auf <strong style="color: #f59e0b">' + result.counter + '×</strong> erhöht.';
                document.getElementById('counter-banner').style.display = 'block';
                document.getElementById('add-form').style.display       = 'none';
                setTimeout(function() { Router.go('dashboard'); }, 2000);
            } else {
                Router.go('dashboard');
            }
        } catch (error) {
            errorEl.textContent  = '⚠ ' + error.message;
            errorEl.style.display = 'block';
            AddBierView.submitting = false;
            button.disabled    = false;
            button.textContent = '🍺 Speichern';
        }
    },

    handleStyleChange: function() {
        if (document.getElementById('add-style').value === '__new__') {
            document.getElementById('add-new-style-row').style.display = 'flex';
            document.getElementById('add-new-style-input').focus();
        } else {
            document.getElementById('add-new-style-row').style.display = 'none';
        }
    },

    saveNewStyle: async function() {
        var styleName = document.getElementById('add-new-style-input').value.trim();
        if (!styleName) return;
        try {
            var result = await Styles.add(styleName);
            await AddBierView._loadStyles(result.name);
            document.getElementById('add-style').value              = result.name;
            document.getElementById('add-new-style-row').style.display = 'none';
        } catch (error) {
            alert(error.message);
        }
    },

    cancelNewStyle: async function() {
        document.getElementById('add-new-style-row').style.display = 'none';
        await AddBierView._loadStyles();
    },

    _loadStyles: async function(selectedStyle) {
        try {
            var styles = await Styles.getAll();
            var html   = '';
            for (var i = 0; i < styles.length; i++) {
                var sel = (styles[i] === selectedStyle) ? 'selected' : '';
                html += '<option value="' + styles[i] + '" ' + sel + '>' + styles[i] + '</option>';
            }
            html += '<option value="__new__">+ Neuer Stil...</option>';
            document.getElementById('add-style').innerHTML = html;
        } catch (error) {}
    },

    _renderStars: function(currentRating) {
        var html = '';
        for (var i = 1; i <= 5; i++) {
            html += '<button type="button" class="star ' + (i <= currentRating ? 'filled' : '') + '"';
            html += ' onclick="AddBierView._setRating(' + i + ')"';
            html += ' onmouseover="AddBierView._hoverStars(' + i + ')"';
            html += ' onmouseout="AddBierView._renderStars(AddBierView.rating)">★</button>';
        }
        document.getElementById('add-stars').innerHTML = html;
        document.getElementById('add-rating-label').textContent = currentRating + '/5';
    },

    _setRating: function(newRating) {
        AddBierView.rating = newRating;
        document.getElementById('add-rating').value = newRating;
        AddBierView._renderStars(newRating);
    },

    _hoverStars: function(hoverRating) {
        var stars = document.querySelectorAll('#add-stars .star');
        for (var i = 0; i < stars.length; i++) {
            stars[i].classList.toggle('filled', i < hoverRating);
        }
        document.getElementById('add-rating-label').textContent = hoverRating + '/5';
    }
};
