// site/js/ui.js
const UI = {
    getApiKey() {
        const input = document.getElementById('api-key-input');
        const saved = localStorage.getItem('etherscan_api_key');
        if (saved && input) input.value = saved;
        return input ? input.value.trim() : (saved || '');
    },
    saveApiKey() {
        const input = document.getElementById('api-key-input');
        if (input && input.value.trim()) {
            localStorage.setItem('etherscan_api_key', input.value.trim());
        }
    },
    initApiKey() {
        const saved = localStorage.getItem('etherscan_api_key');
        const input = document.getElementById('api-key-input');
        if (saved && input) input.value = saved;
        const saveBtn = document.getElementById('save-api-key');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveApiKey());
    },
    showLoading(containerId = 'results') {
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = '<div class="loading" aria-busy="true"></div>';
    },
    showError(msg, containerId = 'results') {
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = '<div class="error-msg">' + this.esc(msg) + '</div>';
    },
    clear(containerId = 'results') {
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = '';
    },
    esc(str) {
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    },
    _validHex(s) {
        return /^0x[0-9a-fA-F]+$/.test(s);
    },
    addrLink(addr) {
        if (!addr) return '';
        const short = addr.slice(0, 6) + '...' + addr.slice(-4);
        if (!this._validHex(addr)) return '<span class="addr">' + this.esc(short) + '</span>';
        return '<span class="addr"><a href="https://etherscan.io/address/' + this.esc(addr) + '" target="_blank" rel="noopener">' + this.esc(short) + '</a></span>';
    },
    addrLinkFull(addr) {
        if (!addr) return '';
        if (!this._validHex(addr)) return '<span class="addr">' + this.esc(addr) + '</span>';
        return '<span class="addr"><a href="https://etherscan.io/address/' + this.esc(addr) + '" target="_blank" rel="noopener">' + this.esc(addr) + '</a></span>';
    },
    txLink(hash) {
        if (!hash) return '';
        const short = hash.slice(0, 10) + '...';
        if (!this._validHex(hash)) return '<span class="mono">' + this.esc(short) + '</span>';
        return '<a href="https://etherscan.io/tx/' + this.esc(hash) + '" target="_blank" rel="noopener" class="mono">' + this.esc(short) + '</a>';
    },
    severityBadge(severity) {
        const cls = (severity || '').toLowerCase();
        return '<span class="badge badge-' + this.esc(cls) + '">' + this.esc(severity) + '</span>';
    },
    tagPills(tags) {
        if (!tags || !tags.length) return '';
        return tags.map(t => '<span class="tag-pill">' + this.esc(t) + '</span>').join(' ');
    },
    ethVal(wei) {
        const eth = Number(wei) / 1e18;
        return eth < 0.0001 ? eth.toExponential(2) : eth.toFixed(4);
    },
    tokenVal(raw, decimals) {
        decimals = decimals || 18;
        const val = Number(raw) / Math.pow(10, decimals);
        return val < 0.01 ? val.toExponential(2) : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
    },
};
