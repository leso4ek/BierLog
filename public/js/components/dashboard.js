var DashboardView = {
    cardMode:   'cards',
    editRatVal: 3,

    init: async function() {
        var user = Auth.current();
        if (user) {
            document.getElementById('nav-user-dash').textContent = user.name || user.username || '';
        }
        document.getElementById('search-input').value = '';
        await DashboardView.load();
    },

    load: async function() {
        document.getElementById('loading-beers').style.display = 'block';
        document.getElementById('beer-container').innerHTML    = '';
        try {
            var results = await Promise.all([Beers.getAll(), Beers.stats()]);
            DashboardView.renderStats(results[1]);
            DashboardView.renderBeerList(results[0]);
        } catch (error) {
            document.getElementById('beer-container').innerHTML =
                '<div class="card empty-state"><div class="icon">⚠</div><h3>Fehler beim Laden</h3><p>' + error.message + '</p></div>';
        } finally {
            document.getElementById('loading-beers').style.display = 'none';
        }
    },

    logout: function() {
        Auth.logout();
        window.location.href = window.location.pathname + '#auth';
        window.location.reload();
    },

    renderStats: function(stats) {
        var items = [
            { icon: '🍺', value: stats.total,                                      label: 'Probiert',      small: false },
            { icon: '⭐', value: stats.avgRating ? (stats.avgRating + ' ★') : '-', label: 'Ø Rating',      small: false },
            { icon: '🏆', value: stats.topStyle  || '-',                            label: 'Lieblingsstil', small: false },
            { icon: '🕐', value: stats.latestBeer ? stats.latestBeer.name : '-',    label: 'Zuletzt',       small: true  }
        ];
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            html += '<div class="card stat-card fade-up stagger-' + (i + 1) + '">';
            html += '<div class="stat-icon">' + item.icon + '</div>';
            html += '<div class="stat-value' + (item.small ? ' sm' : '') + '">' + item.value + '</div>';
            html += '<div class="stat-label">' + item.label + '</div>';
            html += '</div>';
        }
        document.getElementById('stats-grid').innerHTML = html;
    },

    filterAndRender: async function() {
        try {
            var beers = await Beers.getAll();
            DashboardView.renderBeerList(beers);
        } catch (error) {}
    },

    renderBeerList: function(beers) {
        var query     = (document.getElementById('search-input').value || '').toLowerCase();
        var sort      = document.getElementById('sort-select').value || 'date_desc';
        var filtered  = beers.filter(function(b) {
            return b.name.toLowerCase().includes(query)   ||
                   b.origin.toLowerCase().includes(query) ||
                   b.style.toLowerCase().includes(query);
        });
        filtered.sort(function(a, b) {
            if (sort === 'date_desc')   return new Date(b.date)  - new Date(a.date);
            if (sort === 'date_asc')    return new Date(a.date)  - new Date(b.date);
            if (sort === 'rating_desc') return b.rating - a.rating;
            if (sort === 'rating_asc')  return a.rating - b.rating;
            if (sort === 'style')       return a.style.localeCompare(b.style);
            if (sort === 'name')        return a.name.localeCompare(b.name);
            return 0;
        });
        var container = document.getElementById('beer-container');
        var countEl   = document.getElementById('beer-count');
        if (filtered.length === 0) {
            var msg = query ? 'Keine Ergebnisse.' : 'Füge dein erstes Bier hinzu!';
            var btn = !query ? '<button class="btn-primary" onclick="Router.go(\'add\')">Erstes Bier eintragen</button>' : '';
            container.innerHTML = '<div class="card empty-state"><div class="icon">🍻</div><h3>Noch kein Bier hier</h3><p>' + msg + '</p>' + btn + '</div>';
            countEl.textContent = '';
            return;
        }
        container.innerHTML = DashboardView.cardMode === 'cards'
            ? DashboardView._renderCards(filtered)
            : DashboardView._renderTable(filtered);
        countEl.textContent = filtered.length === 1 ? '1 Bier angezeigt' : filtered.length + ' Biere angezeigt';
    },

    setCardView: function(mode) {
        DashboardView.cardMode = mode;
        document.getElementById('btn-cards').className    = mode === 'cards' ? 'btn-primary' : 'btn-ghost';
        document.getElementById('btn-list').className     = mode === 'list'  ? 'btn-primary' : 'btn-ghost';
        document.getElementById('btn-cards').style.padding = '0.6rem 1rem';
        document.getElementById('btn-list').style.padding  = '0.6rem 1rem';
        DashboardView.filterAndRender();
    },

    handleDelete: async function(id, name) {
        if (!confirm('"' + name + '" wirklich löschen?')) return;
        try {
            await Beers.delete(id);
            await DashboardView.load();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    },

    openEdit: async function(id) {
        try {
            var beer = await Beers.getById(id);
            document.getElementById('edit-id').value     = beer.id;
            document.getElementById('edit-name').value   = beer.name;
            document.getElementById('edit-origin').value = beer.origin;
            document.getElementById('edit-notes').value  = beer.notes || '';
            document.getElementById('edit-date').value   = beer.date ? beer.date.split('T')[0] : '';
            document.getElementById('edit-error').style.display = 'none';
            DashboardView.editRatVal = beer.rating;
            DashboardView._renderEditStars(beer.rating);
            await DashboardView._loadStylesInto('edit-style', beer.style);
            document.getElementById('edit-modal').classList.add('open');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    },

    closeModal: function() {
        document.getElementById('edit-modal').classList.remove('open');
        document.body.style.overflow = '';
    },

    handleEditSubmit: async function(event) {
        event.preventDefault();
        var errorEl = document.getElementById('edit-error');
        errorEl.style.display = 'none';
        var id     = document.getElementById('edit-id').value;
        var name   = document.getElementById('edit-name').value.trim();
        var origin = document.getElementById('edit-origin').value.trim();
        var style  = document.getElementById('edit-style').value;
        var rating = parseInt(document.getElementById('edit-rating').value);
        var date   = document.getElementById('edit-date').value;
        var notes  = document.getElementById('edit-notes').value;
        if (!name || !origin) {
            errorEl.textContent  = '⚠ Name und Herkunft sind Pflichtfelder.';
            errorEl.style.display = 'block';
            return;
        }
        var button = document.getElementById('edit-submit-btn');
        button.disabled    = true;
        button.textContent = 'Speichern...';
        try {
            await Beers.update(id, { name: name, origin: origin, style: style, rating: rating, date: date, notes: notes });
            DashboardView.closeModal();
            await DashboardView.load();
        } catch (error) {
            errorEl.textContent  = '⚠ ' + error.message;
            errorEl.style.display = 'block';
        } finally {
            button.disabled    = false;
            button.textContent = '✓ Änderungen speichern';
        }
    },

    handleStyleChange: function(selectId, rowId, inputId) {
        if (document.getElementById(selectId).value === '__new__') {
            document.getElementById(rowId).style.display = 'flex';
            document.getElementById(inputId).focus();
        } else {
            document.getElementById(rowId).style.display = 'none';
        }
    },

    saveNewStyle: async function(selectId, rowId, inputId) {
        var styleName = document.getElementById(inputId).value.trim();
        if (!styleName) return;
        try {
            var result = await Styles.add(styleName);
            await DashboardView._loadStylesInto(selectId, result.name);
            document.getElementById(selectId).value    = result.name;
            document.getElementById(rowId).style.display = 'none';
        } catch (error) {
            alert(error.message);
        }
    },

    cancelNewStyle: async function(selectId, rowId) {
        document.getElementById(rowId).style.display = 'none';
        await DashboardView._loadStylesInto(selectId);
    },

    _renderEditStars: function(rating) {
        var html = '';
        for (var i = 1; i <= 5; i++) {
            html += '<button type="button" class="star ' + (i <= rating ? 'filled' : '') + '"';
            html += ' onclick="DashboardView._setEditRating(' + i + ')"';
            html += ' onmouseover="DashboardView._hoverStars(\'edit-stars\',' + i + ',\'edit-rating-label\')"';
            html += ' onmouseout="DashboardView._renderEditStars(DashboardView.editRatVal)">★</button>';
        }
        document.getElementById('edit-stars').innerHTML = html;
        document.getElementById('edit-rating-label').textContent = rating + '/5';
    },

    _setEditRating: function(rating) {
        DashboardView.editRatVal = rating;
        document.getElementById('edit-rating').value = rating;
        DashboardView._renderEditStars(rating);
    },

    _loadStylesInto: async function(selectId, selectedStyle) {
        try {
            var styles = await Styles.getAll();
            var html   = '';
            for (var i = 0; i < styles.length; i++) {
                var sel = (styles[i] === selectedStyle) ? 'selected' : '';
                html += '<option value="' + styles[i] + '" ' + sel + '>' + styles[i] + '</option>';
            }
            html += '<option value="__new__">+ Neuer Stil...</option>';
            document.getElementById(selectId).innerHTML = html;
        } catch (error) {}
    },

    _hoverStars: function(containerId, rating, labelId) {
        var stars = document.querySelectorAll('#' + containerId + ' .star');
        for (var i = 0; i < stars.length; i++) {
            stars[i].classList.toggle('filled', i < rating);
        }
        document.getElementById(labelId).textContent = rating + '/5';
    },

    _renderCards: function(beers) {
        var html = '<div class="beer-grid">';
        for (var i = 0; i < beers.length; i++) {
            var beer  = beers[i];
            var badge = beer.counter > 1 ? '<span class="counter-badge">×' + beer.counter + '</span>' : '';
            var notes = beer.notes ? '<div class="beer-card-notes">"' + beer.notes + '"</div>' : '';
            html += '<div class="card beer-card">';
            html += '<div class="beer-card-header">';
            html += '  <span class="badge ' + DashboardView._badge(beer.style) + '">' + beer.style + '</span>';
            html += '  <div class="beer-card-meta">' + badge + '<span class="beer-card-date">' + DashboardView._fmtDate(beer.date) + '</span></div>';
            html += '</div>';
            html += '<div class="beer-card-name">' + beer.name + '</div>';
            html += '<div class="beer-card-origin">📍 ' + beer.origin + '</div>';
            html += DashboardView._starsRO(beer.rating, 'sm');
            html += notes;
            html += '<div class="beer-card-actions">';
            html += '  <button class="btn-edit"   onclick="DashboardView.openEdit(\'' + beer.id + '\')">✎ Bearbeiten</button>';
            html += '  <button class="btn-danger" onclick="DashboardView.handleDelete(\'' + beer.id + '\',\'' + DashboardView._esc(beer.name) + '\')">✕ Entfernen</button>';
            html += '</div>';
            html += '</div>';
        }
        return html + '</div>';
    },

    _renderTable: function(beers) {
        var html = '<div class="card" style="overflow: hidden;"><table class="beer-table"><thead><tr>';
        html += '<th>Name</th><th>Stil</th><th>Herkunft</th><th>Rating</th><th>Anzahl</th><th>Datum</th><th></th>';
        html += '</tr></thead><tbody>';
        for (var i = 0; i < beers.length; i++) {
            var beer = beers[i];
            var cnt  = beer.counter > 1
                ? '<span class="counter-badge">×' + beer.counter + '</span>'
                : '<span style="color: #6b3a00;">1</span>';
            html += '<tr>';
            html += '<td style="font-weight: 600; color: #fef9ec;">' + beer.name + '</td>';
            html += '<td><span class="badge ' + DashboardView._badge(beer.style) + '">' + beer.style + '</span></td>';
            html += '<td style="color: rgba(251,191,36,0.7);">' + beer.origin + '</td>';
            html += '<td>' + DashboardView._starsRO(beer.rating, 'sm') + '</td>';
            html += '<td style="text-align: center;">' + cnt + '</td>';
            html += '<td style="color: #92400e; font-size: 0.8rem;">' + DashboardView._fmtDate(beer.date) + '</td>';
            html += '<td><div style="display: flex; gap: 0.75rem;">';
            html += '<button class="btn-edit"   onclick="DashboardView.openEdit(\'' + beer.id + '\')">✎</button>';
            html += '<button class="btn-danger" onclick="DashboardView.handleDelete(\'' + beer.id + '\',\'' + DashboardView._esc(beer.name) + '\')">✕</button>';
            html += '</div></td>';
            html += '</tr>';
        }
        return html + '</tbody></table></div>';
    },

    _starsRO: function(rating, size) {
        var html = '<div class="stars readonly ' + (size || '') + '">';
        for (var i = 1; i <= 5; i++) {
            html += '<span class="star ' + (i <= rating ? 'filled' : '') + '">★</span>';
        }
        return html + '</div>';
    },

    _badge: function(style) {
        if (!style) return 'badge-default';
        var s = style.toLowerCase();
        if (s === 'pils')   return 'badge-pils';
        if (s === 'helles') return 'badge-helles';
        if (s === 'weizen') return 'badge-weizen';
        if (s === 'dunkel') return 'badge-dunkel';
        if (s === 'ipa')    return 'badge-ipa';
        if (s === 'stout')  return 'badge-stout';
        if (s === 'lager')  return 'badge-lager';
        return 'badge-default';
    },

    _fmtDate: function(isoDate) {
        return new Date(isoDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _esc: function(text) {
        if (!text) return '';
        return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('edit-modal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === event.currentTarget) DashboardView.closeModal();
        });
    }
});
