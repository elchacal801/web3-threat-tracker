// site/js/search.js — shard-based on-demand search
(function () {
    'use strict';

    var shardCache = {};     // letter -> array of index entries
    var detailCache = {};    // letter -> array of full entries
    var openRow = null;
    var debounceTimer = null;

    var inputEl   = document.getElementById('search-input');
    var filterEl  = document.getElementById('severity-filter');
    var countEl   = document.getElementById('result-count');
    var resultsEl = document.getElementById('results');

    var MAX_RESULTS = 200;
    var DEBOUNCE_MS = 200;
    var MIN_QUERY   = 2;

    // ------------------------------------------------------------------
    //  DOM helpers
    // ------------------------------------------------------------------
    function el(tag, opts) {
        var node = document.createElement(tag);
        if (opts) {
            if (opts.cls)               node.className = opts.cls;
            if (opts.text !== undefined) node.textContent = String(opts.text);
            if (opts.style)             node.style.cssText = opts.style;
        }
        return node;
    }

    function clearEl(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function showLoading(msg) {
        clearEl(resultsEl);
        var wrap = el('div', { cls: 'loading-msg' });
        wrap.appendChild(el('span', { cls: 'spinner' }));
        wrap.appendChild(el('span', { text: msg || 'Loading\u2026' }));
        resultsEl.appendChild(wrap);
    }

    function showError(msg) {
        clearEl(resultsEl);
        var div = el('div', { cls: 'error-msg', text: String(msg) });
        div.setAttribute('role', 'alert');
        resultsEl.appendChild(div);
    }

    // ------------------------------------------------------------------
    //  Shard key logic
    // ------------------------------------------------------------------
    function shardKey(query) {
        var c = (query || '').charAt(0).toLowerCase();
        return /^[a-z]$/.test(c) ? c : 'numeric';
    }

    function detailLetter(domain) {
        var c = (domain || '').charAt(0).toLowerCase();
        return /^[a-z]$/.test(c) ? c : 'numeric';
    }

    // ------------------------------------------------------------------
    //  Fetch index shard (cached)
    // ------------------------------------------------------------------
    function fetchShard(key) {
        if (shardCache[key] !== undefined) {
            return Promise.resolve(shardCache[key]);
        }
        return fetch('data/index/' + key + '.json')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                shardCache[key] = Array.isArray(data) ? data : [];
                return shardCache[key];
            })
            .catch(function () {
                shardCache[key] = [];
                return [];
            });
    }

    // ------------------------------------------------------------------
    //  Fetch detail bucket (cached)
    // ------------------------------------------------------------------
    function fetchDetails(letter) {
        if (detailCache[letter] !== undefined) {
            return Promise.resolve(detailCache[letter]);
        }
        return fetch('data/details/' + letter + '.json')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                detailCache[letter] = data;
                return data;
            });
    }

    function findEntry(bucket, domain) {
        if (Array.isArray(bucket)) {
            for (var i = 0; i < bucket.length; i++) {
                if (bucket[i].domain === domain || bucket[i].d === domain) return bucket[i];
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    //  Wallet link helper
    // ------------------------------------------------------------------
    function validHex(s) { return /^0x[0-9a-fA-F]+$/.test(s); }

    function makeWalletLink(addr) {
        var span = el('span', { cls: 'addr' });
        if (validHex(addr)) {
            var a = document.createElement('a');
            a.href = 'tools/fund-flow.html?address=' + encodeURIComponent(addr);
            a.textContent = addr;
            a.target = '_blank';
            a.rel = 'noopener';
            span.appendChild(a);
        } else {
            span.textContent = addr;
        }
        return span;
    }

    function makeValueNode(key, value) {
        var isWalletKey = /wallet|address|contract/i.test(key);
        if (Array.isArray(value)) {
            if (value.length === 0) return el('span', { text: '\u2014' });
            var wrap = el('span');
            value.forEach(function (v, i) {
                if (i > 0) wrap.appendChild(document.createTextNode(', '));
                if (isWalletKey && typeof v === 'string') wrap.appendChild(makeWalletLink(v));
                else wrap.appendChild(document.createTextNode(String(v)));
            });
            return wrap;
        }
        if (isWalletKey && typeof value === 'string' && value) return makeWalletLink(value);
        return el('span', { text: String(value == null ? '\u2014' : value) });
    }

    function buildDetailPanel(entry) {
        var panel = el('div', { cls: 'detail-panel' });
        var h3 = el('h3', { text: entry.domain || 'Details' });
        h3.className = 'mono';
        panel.appendChild(h3);
        var dl = document.createElement('dl');
        dl.style.cssText = 'display:grid;grid-template-columns:max-content 1fr;gap:0.3rem 1rem';
        Object.entries(entry).forEach(function (kv) {
            var key = kv[0], val = kv[1];
            if (val === null || val === undefined) return;
            if (Array.isArray(val) && val.length === 0) return;
            dl.appendChild(el('dt', { text: key, style: 'font-weight:600;opacity:0.75;font-size:0.82rem' }));
            var dd = document.createElement('dd');
            dd.style.margin = '0';
            dd.appendChild(makeValueNode(key, val));
            dl.appendChild(dd);
        });
        panel.appendChild(dl);
        return panel;
    }

    // ------------------------------------------------------------------
    //  Toggle detail panel
    // ------------------------------------------------------------------
    function toggleDetail(dataRow, detailRow, domain) {
        if (openRow && openRow === detailRow) {
            detailRow.style.display = 'none';
            dataRow.setAttribute('aria-expanded', 'false');
            openRow = null;
            return;
        }
        if (openRow) {
            openRow.style.display = 'none';
            var prev = openRow.previousElementSibling;
            if (prev) prev.setAttribute('aria-expanded', 'false');
            openRow = null;
        }
        dataRow.setAttribute('aria-expanded', 'true');
        openRow = detailRow;
        clearEl(detailRow.firstChild);
        detailRow.firstChild.appendChild(el('span', { text: 'Loading\u2026', style: 'opacity:0.6' }));
        detailRow.style.display = '';

        fetchDetails(detailLetter(domain))
            .then(function (bucket) {
                var entry = findEntry(bucket, domain);
                clearEl(detailRow.firstChild);
                if (entry) detailRow.firstChild.appendChild(buildDetailPanel(entry));
                else detailRow.firstChild.appendChild(el('p', { text: 'No detail found for: ' + domain, style: 'opacity:0.6' }));
            })
            .catch(function (err) {
                clearEl(detailRow.firstChild);
                detailRow.firstChild.appendChild(el('p', { text: 'Error: ' + String(err.message || err), cls: 'error-msg' }));
            });
    }

    // ------------------------------------------------------------------
    //  Render results table
    // ------------------------------------------------------------------
    function renderResults(hits) {
        clearEl(resultsEl);
        if (hits.length === 0) {
            resultsEl.appendChild(el('p', { text: 'No results found.', style: 'opacity:0.65' }));
            return;
        }
        var wrap = el('div', { cls: 'results-table-wrap' });
        var table = el('table');
        var thead = el('thead');
        var hrow = el('tr');
        ['Domain', 'Severity', 'Confidence', 'Tags', 'Sources'].forEach(function (txt) {
            hrow.appendChild(el('th', { text: txt }));
        });
        thead.appendChild(hrow);
        table.appendChild(thead);

        var tbody = el('tbody');
        hits.forEach(function (item) {
            var domain = item.d || '', sev = item.s || '', conf = item.c || '';
            var tags = Array.isArray(item.t) ? item.t : [];
            var sources = Array.isArray(item.src) ? item.src : [];

            var tr = el('tr', { style: 'cursor:pointer' });
            tr.setAttribute('tabindex', '0');
            tr.setAttribute('aria-expanded', 'false');

            tr.appendChild(el('td')).appendChild(el('span', { cls: 'mono', text: domain }));

            var tdSev = el('td');
            tdSev.appendChild(el('span', { cls: 'badge badge-' + sev.toLowerCase(), text: sev }));
            tr.appendChild(tdSev);

            var tdConf = el('td');
            tdConf.appendChild(el('span', { cls: 'badge badge-' + conf.toLowerCase(), text: conf }));
            tr.appendChild(tdConf);

            var tdTags = el('td');
            tags.forEach(function (tag) { tdTags.appendChild(el('span', { cls: 'tag-pill', text: tag })); });
            tr.appendChild(tdTags);

            tr.appendChild(el('td', { text: sources.join(', ') }));

            var detailTr = el('tr', { style: 'display:none' });
            var detailTd = el('td');
            detailTd.setAttribute('colspan', '5');
            detailTr.appendChild(detailTd);

            function handleActivate() { toggleDetail(tr, detailTr, domain); }
            tr.addEventListener('click', handleActivate);
            tr.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); }
            });

            tbody.appendChild(tr);
            tbody.appendChild(detailTr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        resultsEl.appendChild(wrap);
    }

    // ------------------------------------------------------------------
    //  Search (shard-based)
    // ------------------------------------------------------------------
    function doSearch() {
        var query    = (inputEl ? inputEl.value : '').trim().toLowerCase();
        var severity = filterEl ? filterEl.value : '';

        if (query.length < MIN_QUERY) {
            clearEl(resultsEl);
            if (countEl) countEl.textContent = '';
            if (query.length > 0) {
                resultsEl.appendChild(el('p', { text: 'Type at least ' + MIN_QUERY + ' characters to search.', style: 'opacity:0.5' }));
            }
            return;
        }

        var key = shardKey(query);
        showLoading('Searching\u2026');

        fetchShard(key).then(function (shard) {
            var hits = shard.filter(function (item) {
                var match = (item.d || '').indexOf(query) !== -1;
                var sevMatch = !severity || item.s === severity;
                return match && sevMatch;
            });

            var total = hits.length;
            var limited = hits.slice(0, MAX_RESULTS);

            if (countEl) {
                if (total === 0) countEl.textContent = 'No results';
                else if (total > MAX_RESULTS) countEl.textContent = 'Showing ' + MAX_RESULTS + ' of ' + total.toLocaleString() + ' results';
                else countEl.textContent = total.toLocaleString() + ' result' + (total === 1 ? '' : 's');
            }

            openRow = null;
            renderResults(limited);
        });
    }

    function scheduleSearch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doSearch, DEBOUNCE_MS);
    }

    // ------------------------------------------------------------------
    //  Bootstrap
    // ------------------------------------------------------------------
    clearEl(resultsEl);
    if (countEl) countEl.textContent = '';

    if (inputEl) {
        inputEl.addEventListener('input', scheduleSearch);
        inputEl.removeAttribute('disabled');
        inputEl.setAttribute('placeholder', 'Search domains (min 2 chars)\u2026');
    }
    if (filterEl) {
        filterEl.addEventListener('change', scheduleSearch);
        filterEl.removeAttribute('disabled');
    }
}());
