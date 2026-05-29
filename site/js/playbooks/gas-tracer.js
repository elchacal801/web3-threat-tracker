// site/js/playbooks/gas-tracer.js
// Gas Tracer -- recursive ETH funding chain with known entity detection
//
// Security: all values interpolated into HTML pass through UI.esc() before DOM insertion.

const GasTracer = {

    async trace(address, maxDepth) {
        address  = normalize(address);
        maxDepth = Math.min(Number(maxDepth) || 3, 5);
        if (!address) { UI.showError('Invalid address.'); return; }
        UI.showLoading('results');
        const chain        = [];
        const visited      = new Set();
        const earlyInflows = [];
        try {
            await this._traceRecursive(address, 0, maxDepth, chain, visited, earlyInflows, true);
        } catch (err) {
            UI.showError('Fetch error: ' + err.message);
            return;
        }
        this._render(address, chain, earlyInflows, maxDepth);
    },

    async _traceRecursive(address, depth, maxDepth, chain, visited, earlyInflows, isTarget) {
        if (visited.has(address)) return;
        visited.add(address);

        let txs = [];
        try { txs = await Etherscan.getNormalTxs(address); } catch (_) { txs = []; }
        if (!Array.isArray(txs)) txs = [];

        // Record first 20 inbound txs for the initial target
        if (isTarget) {
            const received = txs.filter(tx =>
                tx.isError !== '1' && tx.value !== '0' && normalize(tx.to) === address
            ).slice(0, 20);
            for (const tx of received) {
                earlyInflows.push({
                    from:      normalize(tx.from),
                    amount:    weiToEth(tx.value),
                    txHash:    tx.hash,
                    timestamp: tx.timeStamp,
                    tag:       tagAddress(tx.from),
                });
            }
        }

        // First inbound ETH tx = funder
        let funderTx = txs.find(tx =>
            tx.isError !== '1' && tx.value !== '0' && normalize(tx.to) === address
        );

        // Fallback to internal txs
        if (!funderTx) {
            let itxs = [];
            try { itxs = await Etherscan.getInternalTxs(address); } catch (_) { itxs = []; }
            if (!Array.isArray(itxs)) itxs = [];
            funderTx = itxs.find(tx =>
                tx.isError !== '1' && tx.value !== '0' && normalize(tx.to) === address
            );
        }

        const tag    = tagAddress(address);
        const funder = funderTx ? normalize(funderTx.from || funderTx.contractAddress || '') : null;

        chain.push({
            address,
            funder,
            amount:    funderTx ? weiToEth(funderTx.value) : null,
            tag,
            txHash:    funderTx ? funderTx.hash      : null,
            timestamp: funderTx ? funderTx.timeStamp : null,
            depth,
        });

        if (funder && !tagAddress(funder) && !visited.has(funder) && depth < maxDepth) {
            await this._traceRecursive(funder, depth + 1, maxDepth, chain, visited, earlyInflows, false);
        }
    },

    _render(target, chain, earlyInflows, maxDepth) {
        const container = document.getElementById('results');
        if (!container) return;

        let html = '<section class="result-section">'
            + '<h2>Gas Funding Chain — ' + UI.addrLinkFull(target) + '</h2>'
            + '<p class="muted">Max depth: ' + UI.esc(maxDepth) + ' &nbsp;|&nbsp; Hops found: ' + UI.esc(chain.length) + '</p>'
            + '<table class="data-table"><thead><tr>'
            + '<th>Depth</th><th>Address</th><th>Entity</th><th>Funder</th>'
            + '<th>Amount (ETH)</th><th>Tx</th><th>Timestamp</th>'
            + '</tr></thead><tbody>';

        for (const entry of chain) {
            const indent = '\u00a0\u00a0\u00a0\u00a0'.repeat(entry.depth);
            const entityLabel = entry.tag ? entry.tag.name : '';
            const entityType  = entry.tag ? entry.tag.type : (entry.depth === 0 ? 'target' : 'external');
            const funderTag   = entry.funder ? tagAddress(entry.funder) : null;
            const funderLabel = funderTag ? funderTag.name : (entry.funder ? shortAddr(entry.funder) : '\u2014');

            html += '<tr>'
                + '<td>' + UI.esc(indent + entry.depth) + '</td>'
                + '<td>' + UI.addrLink(entry.address) + '</td>'
                + '<td>'
                    + (entityLabel ? '<span class="tag-pill">' + UI.esc(entityLabel) + '</span> ' : '')
                    + '<span class="tag-pill">' + UI.esc(entityType) + '</span>'
                + '</td>'
                + '<td>' + (entry.funder ? UI.addrLink(entry.funder) : '<span class="muted">—</span>') + '</td>'
                + '<td>' + (entry.amount !== null ? UI.esc(entry.amount.toFixed(6)) : '<span class="muted">—</span>') + '</td>'
                + '<td>' + (entry.txHash ? UI.txLink(entry.txHash) : '<span class="muted">—</span>') + '</td>'
                + '<td>' + (entry.timestamp ? UI.esc(tsToISO(entry.timestamp)) : '<span class="muted">—</span>') + '</td>'
                + '</tr>';

            if (entry.funder && funderTag) {
                html += '<tr class="subrow"><td colspan="7">'
                    + '\u00a0\u00a0\u00a0\u00a0\u2514 Funder identified as '
                    + '<strong>' + UI.esc(funderTag.name) + '</strong>'
                    + ' <span class="tag-pill">' + UI.esc(funderTag.type) + '</span>'
                    + ' \u2014 recursion stops here.'
                    + '</td></tr>';
            }
        }
        html += '</tbody></table></section>';

        html += '<section class="result-section"><h2>Early Inflows (first 20 received, target address)</h2>';
        if (earlyInflows.length === 0) {
            html += '<p class="muted">No inbound ETH transactions found.</p>';
        } else {
            html += '<table class="data-table"><thead><tr>'
                + '<th>From</th><th>Entity</th><th>Amount (ETH)</th><th>Tx</th><th>Timestamp</th>'
                + '</tr></thead><tbody>';
            for (const inf of earlyInflows) {
                const lbl = inf.tag ? inf.tag.name : shortAddr(inf.from);
                const typ = inf.tag ? inf.tag.type : 'external';
                html += '<tr>'
                    + '<td>' + UI.addrLink(inf.from) + '</td>'
                    + '<td><span class="tag-pill">' + UI.esc(lbl) + '</span> <span class="tag-pill">' + UI.esc(typ) + '</span></td>'
                    + '<td>' + UI.esc(inf.amount.toFixed(6)) + '</td>'
                    + '<td>' + UI.txLink(inf.txHash) + '</td>'
                    + '<td>' + UI.esc(tsToISO(inf.timestamp)) + '</td>'
                    + '</tr>';
            }
            html += '</tbody></table>';
        }
        html += '</section>';

        container.innerHTML = html;
    },
};

document.addEventListener('DOMContentLoaded', () => {
    UI.initApiKey();
    const params    = new URLSearchParams(window.location.search);
    const addrParam = params.get('address');
    const addrInput = document.getElementById('address-input');
    if (addrParam && addrInput) addrInput.value = addrParam;
    const depthInput = document.getElementById('depth-input');
    const form = document.getElementById('trace-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const addr  = addrInput  ? addrInput.value.trim()        : '';
            const depth = depthInput ? parseInt(depthInput.value, 10) || 3 : 3;
            if (addr) GasTracer.trace(addr, depth);
        });
    }
});
