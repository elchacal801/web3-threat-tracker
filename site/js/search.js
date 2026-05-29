// site/js/search.js
(function () {
    'use strict';

    // ------------------------------------------------------------------
    //  State
    // ------------------------------------------------------------------
    var INDEX = null;
    var detailCache = {};
    var openRow = null;
    var debounceTimer = null;

    var inputEl   = document.getElementById('search-input');
    var filterEl  = document.getElementById('severity-filter');
    var countEl   = document.getElementById('result-count');
    var resultsEl = document.getElementById('results');

    var MAX_RESULTS = 200;
    var DEBOUNCE_MS = 200;

    // ------------------------------------------------------------------
    //  DOM helpers
    // ------------------------------------------------------------------
    function el(tag, opts) {
        var node = document.createElement(tag);
        if (opts) {
            if (opts.cls)            node.className = opts.cls;
            if (opts.text !== undefined) node.textContent = String(opts.text);
            if (opts.role)           node.setAttribute('role', opts.role);
            if (opts.style)          node.style.cssText = opts.style;
        }
        return node;
    }

    function clearEl(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    // ------------------------------------------------------------------
    //  Loading / error states
    // ------------------------------------------------------------------
    function showLoading(msg) {
        clearEl(resultsEl);
        var wrap = el('div', { cls: 'loading-msg' });
        var spin = el('span', { cls: 'spinner' });
        spin.setAttribute('aria-hidden', 'true');
        wrap.appendChild(spin);
        wrap.appendChild(el('span', { text: msg || 'Loading…' }));
        resultsEl.appendChild(wrap);
    }

    function showError(msg) {
        clearEl(resultsEl);
        var div = el('div', { cls: 'error-msg', text: String(msg) });
        div.setAttribute('role', 'alert');
        resultsEl.appendChild(div);
    }

    // ------------------------------------------------------------------
    //  Detail helpers
    // ------------------------------------------------------------------
    function detailLetter(domain) {
        var c = (domain || '').charAt(0).toLowerCase();
        return /^[a-z]$/.test(c) ? c : '0';
    }

    function validHex(s) {
        return /^0x[0-9a-fA-F]+$/.test(s);
    }

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
            if (value.length === 0) return el('span', { text: '—' });
            var wrap = el('span');
            value.forEach(function (v, i) {
                if (i > 0) wrap.appendChild(document.createTextNode(', '));
                if (isWalletKey && typeof v === 'string') {
                    wrap.appendChild(makeWalletLink(v));
                } else {
                    wrap.appendChild(document.createTextNode(String(v)));
                }
            });
            return wrap;
        }

        if (isWalletKey && typeof value === 'string' && value) {
            return makeWalletLink(value);
        }

        return el('span', { text: String(value == null ? '—' : value) });
    }

    function buildDetailPanel(entry) {
        var panel = el('div', { cls: 'detail-panel' });
        var h3 = el('h3', { text: entry.domain || entry.d || 'Details' });
        h3.className = 'mono';
        panel.appendChild(h3);

        var dl = document.createElement('dl');
        dl.style.cssText = 'display:grid;grid-template-columns:max-content 1fr;gap:0.3rem 1rem';

        Object.entries(entry).forEach(function (kv) {
            var key = kv[0];
            var val = kv[1];
            if (val === null || val === undefined) return;
            if (Array.isArray(val) && val.length === 0) return;

            var dt = el('dt', {
                text: key,
                style: 'font-weight:600;opacity:0.75;font-size:0.82rem;padding-top:0.1rem'
            });
            var dd = document.createElement('dd');
            dd.style.margin = '0';
            dd.appendChild(makeValueNode(key, val));
            dl.appendChild(dt);
            dl.appendChild(dd);
        });

        panel.appendChild(dl);
        return panel;
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
        } else if (bucket && typeof bucket === 'object') {
            return bucket[domain] || null;
        }
        return null;
    }

    // ------------------------------------------------------------------
    //  Toggle detail panel on row click
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
        detailRow.firstChild.appendChild(
            el('span', { text: 'Loading details…', style: 'opacity:0.6' })
        );
        detailRow.style.display = '';

        fetchDetails(detailLetter(domain))
            .then(function (bucket) {
                var entry = findEntry(bucket, domain);
                clearEl(detailRow.firstChild);
                if (entry) {
                    detailRow.firstChild.appendChild(buildDetailPanel(entry));
                } else {
                    detailRow.firstChild.appendChild(
                        el('p', {
                            text: 'No detail record found for: ' + domain,
                            style: 'opacity:0.6'
                        })
                    );
                }
            })
            .catch(function (err) {
                clearEl(detailRow.firstChild);
                detailRow.firstChild.appendChild(
                    el('p', {
                        text: 'Error loading details: ' + String(err.message || err),
                        cls: 'error-msg'
                    })
                );
            });
    }

    // ------------------------------------------------------------------
    //  Build results table
    // ------------------------------------------------------------------
    function renderResults(hits) {
        clearEl(resultsEl);

        if (hits.length === 0) {
            resultsEl.appendChild(el('p', { text: 'No results found.', style: 'opacity:0.65' }));
            return;
        }

        var wrap = el('div', { cls: 'results-table-wrap' });
        var table = el('table');
        table.setAttribute('role', 'table');

        var thead = el('thead');
        var hrow = el('tr');
        ['Domain', 'Severity', 'Confidence', 'Tags', 'Sources'].forEach(function (txt) {
            var th = el('th', { text: txt });
            th.setAttribute('scope', 'col');
            hrow.appendChild(th);
        });
        thead.appendChild(hrow);
        table.appendChild(thead);

        var tbody = el('tbody');

        hits.forEach(function (item) {
            var domain  = item.d || '';
            var sev     = item.s || '';
            var conf    = item.c || '';
            var tags    = Array.isArray(item.t) ? item.t : [];
            var sources = Array.isArray(item.src) ? item.src : [];

            // Data row
            var tr = el('tr', { style: 'cursor:pointer' });
            tr.setAttribute('tabindex', '0');
            tr.setAttribute('aria-expanded', 'false');
            tr.setAttribute('title', 'Click to expand details');

            var tdDomain = el('td');
            tdDomain.appendChild(el('span', { cls: 'mono', text: domain }));
            tr.appendChild(tdDomain);

            var tdSev = el('td');
            tdSev.appendChild(el('span', { cls: 'badge badge-' + sev.toLowerCase(), text: sev }));
            tr.appendChild(tdSev);

            var tdConf = el('td');
            tdConf.appendChild(el('span', { cls: 'badge badge-' + conf.toLowerCase(), text: conf }));
            tr.appendChild(tdConf);

            var tdTags = el('td');
            tags.forEach(function (tag) {
                tdTags.appendChild(el('span', { cls: 'tag-pill', text: tag }));
            });
            tr.appendChild(tdTags);

            tr.appendChild(el('td', { text: sources.join(', ') }));

            // Detail row (hidden by default)
            var detailTr = el('tr', { style: 'display:none' });
            var detailTd = el('td');
            detailTd.setAttribute('colspan', '5');
            detailTr.appendChild(detailTd);

            function handleActivate() {
                toggleDetail(tr, detailTr, domain);
            }
            tr.addEventListener('click', handleActivate);
            tr.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleActivate();
                }
            });

            tbody.appendChild(tr);
            tbody.appendChild(detailTr);
        });

        table.appendChild(tbody);
        wrap.appendChild(table);
        resultsEl.appendChild(wrap);
    }

    // ------------------------------------------------------------------
    //  Search logic
    // ------------------------------------------------------------------
    function doSearch() {
        if (!INDEX) return;

        var query    = (inputEl ? inputEl.value : '').trim().toLowerCase();
        var severity = filterEl ? filterEl.value : '';

        if (!severity && query.length < 2) {
            clearEl(resultsEl);
            if (countEl) countEl.textContent = '';
            return;
        }

        var hits = INDEX.filter(function (item) {
            var domainMatch = !query || (item.d || '').toLowerCase().indexOf(query) !== -1;
            var sevMatch    = !severity || item.s === severity;
            return domainMatch && sevMatch;
        });

        var total   = hits.length;
        var limited = hits.slice(0, MAX_RESULTS);

        if (countEl) {
            if (total === 0) {
                countEl.textContent = 'No results';
            } else if (total > MAX_RESULTS) {
                countEl.textContent =
                    'Showing ' + MAX_RESULTS + ' of ' + total.toLocaleString() + ' results';
            } else {
                countEl.textContent =
                    total.toLocaleString() + ' result' + (total === 1 ? '' : 's');
            }
        }

        openRow = null;
        renderResults(limited);
    }

    function scheduleSearch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doSearch, DEBOUNCE_MS);
    }

    // ------------------------------------------------------------------
    //  Bootstrap
    // ------------------------------------------------------------------
    showLoading('Loading search index…');

    fetch('data/search-index.json')
        .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + resp.statusText);
            return resp.json();
        })
        .then(function (data) {
            INDEX = Array.isArray(data) ? data : [];
            clearEl(resultsEl);
            if (countEl) countEl.textContent = '';

            if (inputEl) {
                inputEl.addEventListener('input', scheduleSearch);
                inputEl.removeAttribute('disabled');
            }
            if (filterEl) {
                filterEl.addEventListener('change', scheduleSearch);
                filterEl.removeAttribute('disabled');
            }

            // Run immediately if a severity filter is pre-set
            if (filterEl && filterEl.value) doSearch();
        })
        .catch(function (err) {
            showError('Failed to load search index: ' + String(err.message || err));
        });
}());
