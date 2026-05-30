// site/js/playbooks/mint-tracker.js
// Mint tracker: detects token mints (Transfer from null address) via event logs.
// Depends on: common.js, ui.js

const MintTracker = {

    async track(contractAddress, fromBlock, toBlock, decimals) {
        contractAddress = normalize(contractAddress);

        // 1. Auto-detect token decimals via eth_call decimals() selector 0x313ce567
        if (decimals === null || decimals === undefined || decimals === '') {
            try {
                const raw = await Etherscan.ethCall(contractAddress, '0x313ce567');
                decimals = raw && raw !== '0x' ? parseInt(raw, 16) : 18;
            } catch (_) {
                decimals = 18;
            }
            if (isNaN(decimals) || decimals < 0 || decimals > 77) decimals = 18;
        } else {
            decimals = parseInt(decimals, 10);
            if (isNaN(decimals)) decimals = 18;
        }

        fromBlock = fromBlock || 0;
        toBlock   = toBlock   || 'latest';

        // 2. Query Transfer events from null address (mints)
        const nullTopic = '0x' + '0'.repeat(64);
        const logs = await Etherscan.getLogs(
            contractAddress,
            EVENTS.TRANSFER,
            fromBlock,
            toBlock,
            { topic1: nullTopic, topic0_1_opr: 'and' }
        );

        const mintLogs = Array.isArray(logs) ? logs : [];

        // 3. Parse each mint log: recipient from topics[2], amount from data
        const mintEvents = mintLogs.map(log => {
            const topics    = log.topics || [];
            const recipient = topics[2] ? topicToAddr(topics[2]) : null;
            const amount    = weiToToken(parseInt(log.data || '0x0', 16), decimals);
            return {
                blockNumber: parseInt(log.blockNumber, 16),
                txHash:      log.transactionHash,
                recipient,
                amount,
                ts: log.timeStamp,
            };
        }).sort((a, b) => a.blockNumber - b.blockNumber);

        // 4. Aggregate by recipient
        const byRecipient = {};
        let totalMinted = 0;
        for (const ev of mintEvents) {
            const addr = ev.recipient || 'unknown';
            if (!byRecipient[addr]) {
                byRecipient[addr] = { address: addr, total: 0, count: 0, tag: tagAddress(addr) };
            }
            byRecipient[addr].total += ev.amount;
            byRecipient[addr].count += 1;
            totalMinted += ev.amount;
        }

        const recipients = Object.values(byRecipient).sort((a, b) => b.total - a.total);

        // 5. Render
        this._render(contractAddress, { decimals, totalMinted, mintEvents, recipients });
    },

    _render(contractAddress, d) {
        const el = document.getElementById('results');
        if (!el) return;

        const { decimals, totalMinted, mintEvents, recipients } = d;
        const EM  = '\u2014';
        const fmt = (n) => n < 0.01 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
        const parts = [];

        // Summary panel
        parts.push('<div class="detail-panel"><h3>Mint Summary</h3>'
            + '<div class="stats-grid">'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(fmt(totalMinted)) + '</span><span class="stat-label">Total Minted</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(mintEvents.length) + '</span><span class="stat-label">Mint Events</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(recipients.length) + '</span><span class="stat-label">Unique Recipients</span></div>'
            + '<div class="stat-card"><span class="stat-value">' + UI.esc(decimals) + '</span><span class="stat-label">Decimals</span></div>'
            + '</div>'
            + '<p><strong>Contract:</strong> ' + UI.addrLinkFull(contractAddress) + '</p>'
            + '</div>');

        if (mintEvents.length === 0) {
            parts.push('<div class="detail-panel"><p><em>No mint events found in the specified block range.</em></p></div>');
            el.innerHTML = parts.join('');
            return;
        }

        // By-recipient table (sorted by total desc)
        let recipRows = '';
        for (const r of recipients) {
            const tag = r.tag;
            recipRows += '<tr>'
                + '<td>' + UI.addrLink(r.address) + (tag ? ' <span class="tag-pill">' + UI.esc(tag.name) + '</span>' : '') + '</td>'
                + '<td class="mono">' + UI.esc(fmt(r.total)) + '</td>'
                + '<td class="mono">' + UI.esc(r.count) + '</td>'
                + '</tr>';
        }
        parts.push('<div class="detail-panel"><h3>By Recipient (' + UI.esc(recipients.length) + ')</h3>'
            + '<div class="results-table-wrap"><table>'
            + '<thead><tr><th>Recipient</th><th>Total Minted</th><th>Events</th></tr></thead>'
            + '<tbody>' + recipRows + '</tbody></table></div></div>');

        // All mint events (capped at 500, showing most recent)
        const displayEvents = mintEvents.length > 500 ? mintEvents.slice(-500) : mintEvents;
        const capped = mintEvents.length > 500;
        let evRows = '';
        for (const ev of displayEvents) {
            const tag = ev.recipient ? tagAddress(ev.recipient) : null;
            evRows += '<tr>'
                + '<td class="mono">' + UI.esc(ev.blockNumber) + '</td>'
                + '<td>' + (ev.recipient ? UI.addrLink(ev.recipient) : EM)
                + (tag ? ' <span class="tag-pill">' + UI.esc(tag.name) + '</span>' : '') + '</td>'
                + '<td class="mono">' + UI.esc(fmt(ev.amount)) + '</td>'
                + '<td>' + (ev.txHash ? UI.txLink(ev.txHash) : EM) + '</td>'
                + '</tr>';
        }
        const cap_note = capped
            ? ' <small>(showing last 500 of ' + UI.esc(mintEvents.length) + ')</small>'
            : ' (' + UI.esc(mintEvents.length) + ')';
        parts.push('<div class="detail-panel"><h3>Mint Events' + cap_note + '</h3>'
            + '<div class="results-table-wrap"><table>'
            + '<thead><tr><th>Block</th><th>Recipient</th><th>Amount</th><th>Tx</th></tr></thead>'
            + '<tbody>' + evRows + '</tbody></table></div></div>');

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
        const address   = (document.getElementById('address-input')?.value   || '').trim();
        const fromBlock = (document.getElementById('from-block')?.value       || '').trim() || null;
        const toBlock   = (document.getElementById('to-block')?.value         || '').trim() || null;
        const decimals  = (document.getElementById('decimals-input')?.value   || '').trim() || null;
        if (!address) return;
        UI.showLoading('results');
        try {
            await MintTracker.track(address, fromBlock, toBlock, decimals);
        } catch (err) {
            UI.showError(err.message || String(err));
        }
    });
});
