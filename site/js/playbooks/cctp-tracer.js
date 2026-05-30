// site/js/playbooks/cctp-tracer.js
// CCTP Tracer: detects Circle cross-chain USDC transfer activity for an address.
// Depends on: common.js, ui.js

const CCTPTracer = {

    async trace(address) {
        address = normalize(address);

        const cctpAddrs = new Set([
            CCTP.TOKEN_MESSENGER.toLowerCase(),
            CCTP.MESSAGE_TRANSMITTER.toLowerCase(),
        ]);

        // Strategy 1: ERC-20 transfers where from = CCTP contract (inbound)
        // Strategy 2: Normal txs where to = CCTP contract (outbound)
        const [erc20Txs, normalTxs] = await Promise.all([
            Etherscan.getERC20Transfers(address).catch(() => []),
            Etherscan.getNormalTxs(address).catch(() => []),
        ]);

        const seen      = new Set();
        const transfers = [];

        // Inbound: ERC-20 token received from a CCTP contract
        if (Array.isArray(erc20Txs)) {
            for (const tx of erc20Txs) {
                const from = normalize(tx.from);
                if (!cctpAddrs.has(from)) continue;
                if (seen.has(tx.hash)) continue;
                seen.add(tx.hash);

                const dec      = parseInt(tx.tokenDecimal || '6', 10);
                const decimals = isNaN(dec) ? 6 : dec;
                const amount   = weiToToken(tx.value || '0', decimals);
                const tag      = tagAddress(from);

                transfers.push({
                    txHash:      tx.hash,
                    direction:   'inbound',
                    from,
                    to:          normalize(tx.to),
                    amount,
                    symbol:      tx.tokenSymbol || 'USDC',
                    blockNumber: parseInt(tx.blockNumber, 10),
                    ts:          tx.timeStamp,
                    via:         tag ? tag.name : from,
                });
            }
        }

        // Outbound: normal tx sent by address to a CCTP contract
        if (Array.isArray(normalTxs)) {
            for (const tx of normalTxs) {
                const to = normalize(tx.to || '');
                if (!cctpAddrs.has(to)) continue;
                if (seen.has(tx.hash)) continue;
                seen.add(tx.hash);

                const tag = tagAddress(to);
                transfers.push({
                    txHash:      tx.hash,
                    direction:   'outbound',
                    from:        normalize(tx.from),
                    to,
                    amount:      null,   // ETH value not meaningful for USDC CCTP calls
                    symbol:      'USDC',
                    blockNumber: parseInt(tx.blockNumber, 10),
                    ts:          tx.timeStamp,
                    via:         tag ? tag.name : to,
                });
            }
        }

        // Sort chronologically
        transfers.sort((a, b) => a.blockNumber - b.blockNumber);

        // Total inbound USDC (where amount is known)
        const totalUsdc = transfers
            .filter(t => t.direction === 'inbound' && t.amount !== null)
            .reduce((sum, t) => sum + t.amount, 0);

        this._render(address, { transfers, totalUsdc });
    },

    _render(address, d) {
        const el = document.getElementById('results');
        if (!el) return;

        const { transfers, totalUsdc } = d;
        const EM  = '\u2014';
        const fmt = (n) => n === null ? EM
            : (n < 0.01 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));
        const parts = [];

        // Summary panel
        const inbound  = transfers.filter(t => t.direction === 'inbound').length;
        const outbound = transfers.filter(t => t.direction === 'outbound').length;
        parts.push('<div class="detail-panel"><h3>CCTP Trace Summary</h3>'
            + '<div class="stats-grid">'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(transfers.length) + '</span><span class="stat-label">CCTP Interactions</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(fmt(totalUsdc))   + '</span><span class="stat-label">Inbound USDC</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(inbound)           + '</span><span class="stat-label">Inbound</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(outbound)          + '</span><span class="stat-label">Outbound</span></div>'
            + '</div>'
            + '<p><strong>Address:</strong> ' + UI.addrLinkFull(address) + '</p>'
            + '</div>');

        if (transfers.length === 0) {
            parts.push('<div class="detail-panel"><p><em>No CCTP interactions found for this address.</em></p></div>');
            el.innerHTML = parts.join('');
            return;
        }

        // Transfers table
        let rows = '';
        for (const t of transfers) {
            const dirBadge = t.direction === 'inbound'
                ? '<span class="badge badge-legitimate">\u2193 Inbound</span>'
                : '<span class="badge badge-suspicious">\u2191 Outbound</span>';
            const counterpart = t.direction === 'inbound' ? t.from : t.to;
            const cpTag = tagAddress(counterpart);
            rows += '<tr>'
                + '<td class="mono">' + UI.esc(t.blockNumber) + '</td>'
                + '<td>' + dirBadge + '</td>'
                + '<td>' + UI.addrLink(counterpart) + (cpTag ? ' <span class="tag-pill">' + UI.esc(cpTag.name) + '</span>' : '') + '</td>'
                + '<td class="mono">' + UI.esc(fmt(t.amount)) + ' ' + UI.esc(t.symbol) + '</td>'
                + '<td>' + (t.txHash ? UI.txLink(t.txHash) : EM) + '</td>'
                + '</tr>';
        }
        parts.push('<div class="detail-panel"><h3>CCTP Transfers (' + UI.esc(transfers.length) + ')</h3>'
            + '<div class="results-table-wrap"><table>'
            + '<thead><tr><th>Block</th><th>Direction</th><th>Counterpart</th><th>Amount</th><th>Tx</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div></div>');

        // All values pass through UI.esc / UI.addrLink / UI.txLink (XSS-safe)
        el.innerHTML = parts.join('');
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    UI.initApiKey();
    await loadLabels();
    const form = document.getElementById('trace-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const address = (document.getElementById('address-input')?.value || '').trim();
        if (!address) return;
        UI.showLoading('results');
        try {
            await CCTPTracer.trace(address);
        } catch (err) {
            UI.showError(err.message || String(err));
        }
    });
});
