// site/js/dashboard.js
(function () {
    'use strict';

    var APP = document.getElementById('app');

    // ------------------------------------------------------------------ //
    //  DOM utility — create element with optional class and text
    // ------------------------------------------------------------------ //
    function el(tag, opts) {
        var node = document.createElement(tag);
        if (opts) {
            if (opts.cls) node.className = opts.cls;
            if (opts.text !== undefined) node.textContent = opts.text;
            if (opts.role) node.setAttribute('role', opts.role);
            if (opts.ariaLabel) node.setAttribute('aria-label', opts.ariaLabel);
            if (opts.style) node.style.cssText = opts.style;
        }
        return node;
    }

    // ------------------------------------------------------------------ //
    //  Spinner / error via DOM methods (no innerHTML)
    // ------------------------------------------------------------------ //
    function showSpinner() {
        while (APP.firstChild) APP.removeChild(APP.firstChild);
        var wrap = el('div', { cls: 'loading-msg' });
        var spin = el('span', { cls: 'spinner' });
        spin.setAttribute('aria-hidden', 'true');
        var txt = el('span', { text: 'Loading stats\u2026' });
        wrap.appendChild(spin);
        wrap.appendChild(txt);
        APP.appendChild(wrap);
    }

    function showError(msg) {
        while (APP.firstChild) APP.removeChild(APP.firstChild);
        var div = el('div', { cls: 'error-msg', text: String(msg) });
        div.setAttribute('role', 'alert');
        APP.appendChild(div);
    }

    function fmtNumber(n) {
        return Number(n).toLocaleString();
    }

    // ------------------------------------------------------------------ //
    //  Stat card
    // ------------------------------------------------------------------ //
    function makeStatCard(value, label) {
        var card = el('article', { cls: 'stat-card' });
        card.appendChild(el('span', { cls: 'stat-value', text: fmtNumber(value) }));
        card.appendChild(el('span', { cls: 'stat-label', text: label }));
        return card;
    }

    // ------------------------------------------------------------------ //
    //  Breakdown table
    // ------------------------------------------------------------------ //
    function makeBreakdownTable(title, rows) {
        var wrap = el('div');

        wrap.appendChild(el('h3', { text: title }));

        var table = el('table');
        table.style.cssText = 'width:100%;table-layout:fixed';
        table.setAttribute('role', 'table');

        // thead
        var thead = el('thead');
        var hrow = el('tr');
        ['Name', 'Count'].forEach(function (txt) {
            hrow.appendChild(el('th', { text: txt }));
        });
        thead.appendChild(hrow);
        table.appendChild(thead);

        // tbody
        var tbody = el('tbody');
        rows.forEach(function (row) {
            var tr = el('tr');
            tr.appendChild(el('td', { text: row.label }));
            tr.appendChild(el('td', { text: fmtNumber(row.count) }));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        wrap.appendChild(table);
        return wrap;
    }

    // ------------------------------------------------------------------ //
    //  Render
    // ------------------------------------------------------------------ //
    function render(stats) {
        while (APP.firstChild) APP.removeChild(APP.firstChild);

        // Timestamp
        if (stats.generated_at) {
            var d = new Date(stats.generated_at);
            var formatted = isNaN(d.getTime())
                ? stats.generated_at
                : d.toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                });
            var ts = el('p', {
                text: 'Last updated: ' + formatted,
                style: 'opacity:0.65;font-size:0.85rem;margin-bottom:0.5rem'
            });
            APP.appendChild(ts);
        }

        // Stat cards
        var maliciousCount = (stats.by_severity || {})['MALICIOUS'] || 0;
        var sourceCount = Object.keys(stats.by_source || {}).length;
        var tagCount = Object.keys(stats.by_tag || {}).length;

        var grid = el('div', { cls: 'stats-grid' });
        grid.appendChild(makeStatCard(stats.total || 0, 'Total Entries'));
        grid.appendChild(makeStatCard(maliciousCount, 'Malicious Domains'));
        grid.appendChild(makeStatCard(sourceCount, 'Data Sources'));
        grid.appendChild(makeStatCard(tagCount, 'Threat Categories'));
        APP.appendChild(grid);

        // Breakdown tables row
        var tablesRow = el('div', {
            style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;margin-top:1.5rem'
        });

        // By Severity
        var severityRows = Object.entries(stats.by_severity || {}).map(function (kv) {
            return { label: kv[0], count: kv[1] };
        });
        tablesRow.appendChild(makeBreakdownTable('By Severity', severityRows));

        // By Source — sorted desc
        var sourceRows = Object.entries(stats.by_source || {})
            .sort(function (a, b) { return b[1] - a[1]; })
            .map(function (kv) { return { label: kv[0], count: kv[1] }; });
        tablesRow.appendChild(makeBreakdownTable('By Source', sourceRows));

        // By Tag — sorted desc
        var tagRows = Object.entries(stats.by_tag || {})
            .sort(function (a, b) { return b[1] - a[1]; })
            .map(function (kv) { return { label: kv[0], count: kv[1] }; });
        tablesRow.appendChild(makeBreakdownTable('By Tag', tagRows));

        APP.appendChild(tablesRow);
    }

    // ------------------------------------------------------------------ //
    //  Bootstrap
    // ------------------------------------------------------------------ //
    showSpinner();

    fetch('data/stats.json')
        .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + resp.statusText);
            return resp.json();
        })
        .then(function (stats) {
            render(stats);
        })
        .catch(function (err) {
            showError('Failed to load stats: ' + String(err.message || err));
        });
}());
