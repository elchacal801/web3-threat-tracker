// site/js/playbooks/fund-flow.js
// Fund Flow Tracer -- maps ETH/ERC-20 transfers, tags known entities, finds exit paths
//
// Security: all values interpolated into HTML pass through UI.esc() before DOM insertion.

const FundFlow = {

    async trace(address, chainId) {
        address = normalize(address);
        if (!address) { UI.showError('Invalid address.'); return; }
        UI.showLoading('results');
        const adapter = getAdapter(chainId || 1);
        let normalTxs = [], internalTxs = [], erc20Txs = [];
        try {
            [normalTxs, internalTxs, erc20Txs] = await Promise.all([
                adapter.getNormalTxs(address),
                adapter.getInternalTxs(address),
                adapter.getERC20Transfers(address),
            ]);
        } catch (err) {
            UI.showError('Fetch error: ' + err.message);
            return;
        }
        if (!Array.isArray(normalTxs))   normalTxs   = [];
        if (!Array.isArray(internalTxs)) internalTxs = [];
        if (!Array.isArray(erc20Txs))    erc20Txs    = [];
        const truncated = !!(normalTxs._truncated || internalTxs._truncated || erc20Txs._truncated);
        const { nodes, edges } = this._buildGraph(address, normalTxs, internalTxs, erc20Txs);
        const exitPaths        = this._findExitPaths(address, edges, nodes);
        const fundingSources   = this._findFundingSources(address, edges, nodes);
        this._render(address, nodes, edges, exitPaths, fundingSources, truncated, adapter);
    },

    _buildGraph(target, normalTxs, internalTxs, erc20Txs) {
        const nodes    = new Map();
        const edgesMap = new Map();

        const ensureNode = (addr) => {
            const a = normalize(addr);
            if (!a) return null;
            if (!nodes.has(a)) {
                const tag  = tagAddress(a);
                const type = a === target ? 'target' : tag ? tag.type : 'external';
                nodes.set(a, { address: a, label: tag ? tag.name : shortAddr(a), type, tag, volIn: 0, volOut: 0 });
            }
            return nodes.get(a);
        };

        const addEdge = (from, to, amount, token, txHash, timestamp) => {
            from = normalize(from); to = normalize(to);
            if (!from || !to) return;
            const key = txHash + '-' + from + '-' + to + '-' + token + '-' + amount;
            if (edgesMap.has(key)) return;
            ensureNode(from); ensureNode(to);
            const nFrom = nodes.get(from); const nTo = nodes.get(to);
            if (nFrom) nFrom.volOut += amount;
            if (nTo)   nTo.volIn   += amount;
            edgesMap.set(key, { from, to, amount, token, txHash, timestamp });
        };

        for (const tx of normalTxs) {
            if (tx.isError === '1' || !tx.value || tx.value === '0') continue;
            addEdge(tx.from, tx.to, weiToEth(tx.value), 'ETH', tx.hash, tx.timeStamp);
        }
        for (const tx of internalTxs) {
            if (tx.isError === '1' || !tx.value || tx.value === '0') continue;
            addEdge(tx.from || tx.contractAddress || '', tx.to, weiToEth(tx.value), 'ETH', tx.hash, tx.timeStamp);
        }
        for (const tx of erc20Txs) {
            const decimals = parseInt(tx.tokenDecimal, 10) || 18;
            addEdge(tx.from, tx.to, weiToToken(tx.value, decimals), tx.tokenSymbol || 'ERC20', tx.hash, tx.timeStamp);
        }
        ensureNode(target);
        return { nodes, edges: Array.from(edgesMap.values()) };
    },

    _findExitPaths(target, edges, nodes) {
        return edges.filter(e => {
            if (normalize(e.from) !== target) return false;
            const n = nodes.get(normalize(e.to));
            return n && (n.type === 'cex' || n.type === 'bridge' || n.type === 'mixer');
        });
    },

    _findFundingSources(target, edges, nodes) {
        return edges.filter(e => {
            if (normalize(e.to) !== target) return false;
            const n = nodes.get(normalize(e.from));
            return n && (n.type === 'cex' || n.type === 'bridge' || n.type === 'mixer' || n.type === 'dex');
        });
    },

    _render(target, nodes, edges, exitPaths, fundingSources, truncated, adapter) {
        const container = document.getElementById('results');
        if (!container) return;
        const explorerBase = adapter ? adapter.chain.explorer : 'https://etherscan.io';

        const typeCounts = {};
        for (const n of nodes.values()) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
        const typeBreakdown = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([t, c]) => '<span class="tag-pill">' + UI.esc(t) + ': ' + UI.esc(c) + '</span>')
            .join(' ');

        const tNode  = nodes.get(target);
        const volIn  = tNode ? tNode.volIn.toFixed(4)  : '0';
        const volOut = tNode ? tNode.volOut.toFixed(4) : '0';

        let html = '';
        if (truncated) {
            html += '<div class="error-msg" style="border-color:var(--color-suspicious);color:var(--color-suspicious)">'
                + 'Results may be truncated. Etherscan returned the maximum 10,000 transactions for one or more query types. '
                + 'Some transfers may be missing — exit path analysis may be incomplete for this address.'
                + '</div>';
        }
        html += '<section class="result-section">'
            + '<h2>Fund Flow \u2014 ' + UI.addrLinkFull(target, explorerBase) + '</h2>'
            + '<table class="data-table"><tbody>'
            + '<tr><td>Nodes</td><td>'             + UI.esc(nodes.size)            + '</td></tr>'
            + '<tr><td>Edges (transfers)</td><td>' + UI.esc(edges.length)          + '</td></tr>'
            + '<tr><td>Exit paths</td><td>'        + UI.esc(exitPaths.length)      + '</td></tr>'
            + '<tr><td>Funding sources</td><td>'   + UI.esc(fundingSources.length) + '</td></tr>'
            + '<tr><td>Target vol in</td><td>'     + UI.esc(volIn)                 + '</td></tr>'
            + '<tr><td>Target vol out</td><td>'    + UI.esc(volOut)                + '</td></tr>'
            + '<tr><td>Entity types</td><td>'      + typeBreakdown                 + '</td></tr>'
            + '</tbody></table></section>';

        html += '<section class="result-section"><h2>Exit Paths (' + UI.esc(exitPaths.length) + ')</h2>';
        if (exitPaths.length === 0) {
            html += '<p class="muted">No exit paths to known entities detected.</p>';
        } else {
            html += '<table class="data-table"><thead><tr>'
                + '<th>To</th><th>Entity</th><th>Type</th><th>Amount</th><th>Token</th><th>Tx</th><th>Timestamp</th>'
                + '</tr></thead><tbody>';
            for (const e of exitPaths) {
                const n = nodes.get(normalize(e.to));
                html += '<tr>'
                    + '<td>' + UI.addrLink(e.to, explorerBase) + '</td>'
                    + '<td>' + UI.esc(n ? n.label : shortAddr(e.to)) + '</td>'
                    + '<td><span class="tag-pill">' + UI.esc(n ? n.type : 'unknown') + '</span></td>'
                    + '<td>' + UI.esc(e.amount.toFixed(4)) + '</td>'
                    + '<td>' + UI.esc(e.token) + '</td>'
                    + '<td>' + UI.txLink(e.txHash, explorerBase) + '</td>'
                    + '<td>' + UI.esc(tsToISO(e.timestamp)) + '</td>'
                    + '</tr>';
            }
            html += '</tbody></table>';
        }
        html += '</section>';

        html += '<section class="result-section"><h2>Funding Sources (' + UI.esc(fundingSources.length) + ')</h2>';
        if (fundingSources.length === 0) {
            html += '<p class="muted">No inbound transfers from known entities detected.</p>';
        } else {
            html += '<table class="data-table"><thead><tr>'
                + '<th>From</th><th>Entity</th><th>Type</th><th>Amount</th><th>Token</th><th>Tx</th><th>Timestamp</th>'
                + '</tr></thead><tbody>';
            for (const e of fundingSources) {
                const n = nodes.get(normalize(e.from));
                html += '<tr>'
                    + '<td>' + UI.addrLink(e.from, explorerBase) + '</td>'
                    + '<td>' + UI.esc(n ? n.label : shortAddr(e.from)) + '</td>'
                    + '<td><span class="tag-pill">' + UI.esc(n ? n.type : 'unknown') + '</span></td>'
                    + '<td>' + UI.esc(e.amount.toFixed(4)) + '</td>'
                    + '<td>' + UI.esc(e.token) + '</td>'
                    + '<td>' + UI.txLink(e.txHash, explorerBase) + '</td>'
                    + '<td>' + UI.esc(tsToISO(e.timestamp)) + '</td>'
                    + '</tr>';
            }
            html += '</tbody></table>';
        }
        html += '</section>';

        const displayEdges = edges.slice(0, 500);
        const cappedNote = edges.length > 500
            ? ' <span class="muted">(showing first 500 of ' + UI.esc(edges.length) + ')</span>' : '';
        html += '<section class="result-section"><h2>All Transfers (' + UI.esc(edges.length) + ')' + cappedNote + '</h2>'
            + '<table class="data-table"><thead><tr>'
            + '<th>Tx</th><th>From</th><th>To</th><th>Amount</th><th>Token</th><th>Timestamp</th>'
            + '</tr></thead><tbody>';
        for (const e of displayEdges) {
            html += '<tr>'
                + '<td>' + UI.txLink(e.txHash, explorerBase) + '</td>'
                + '<td>' + UI.addrLink(e.from, explorerBase) + '</td>'
                + '<td>' + UI.addrLink(e.to, explorerBase) + '</td>'
                + '<td>' + UI.esc(e.amount.toFixed(6)) + '</td>'
                + '<td>' + UI.esc(e.token) + '</td>'
                + '<td>' + UI.esc(tsToISO(e.timestamp)) + '</td>'
                + '</tr>';
        }
        html += '</tbody></table></section>';
        container.innerHTML = html;
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    UI.initApiKey();
    await loadLabels();
    const params    = new URLSearchParams(window.location.search);
    const addrParam = params.get('address');
    const chainParam = params.get('chain');
    const addrInput = document.getElementById('address-input');
    const chainSelect = document.getElementById('chain-select');
    if (addrParam && addrInput) addrInput.value = addrParam;
    if (chainParam && chainSelect) chainSelect.value = chainParam;
    const form = document.getElementById('trace-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const addr = addrInput ? addrInput.value.trim() : '';
            const chainId = chainSelect ? parseInt(chainSelect.value, 10) : 1;
            if (addr) FundFlow.trace(addr, chainId);
        });
    }
});
