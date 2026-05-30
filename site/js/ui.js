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
    getHeliusKey() {
        const input = document.getElementById('helius-key-input');
        const saved = localStorage.getItem('helius_api_key');
        if (saved && input) input.value = saved;
        return input ? input.value.trim() : (saved || '');
    },
    saveHeliusKey() {
        const input = document.getElementById('helius-key-input');
        if (input && input.value.trim()) {
            localStorage.setItem('helius_api_key', input.value.trim());
        }
    },
    initApiKey() {
        const saved = localStorage.getItem('etherscan_api_key');
        const input = document.getElementById('api-key-input');
        if (saved && input) input.value = saved;
        const saveBtn = document.getElementById('save-api-key');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveApiKey());

        // Helius key
        const heliusSaved = localStorage.getItem('helius_api_key');
        const heliusInput = document.getElementById('helius-key-input');
        if (heliusSaved && heliusInput) heliusInput.value = heliusSaved;
        const heliusSaveBtn = document.getElementById('save-helius-key');
        if (heliusSaveBtn) heliusSaveBtn.addEventListener('click', () => this.saveHeliusKey());

        // Toggle API key sections based on chain selection
        const chainSelect = document.getElementById('chain-select');
        if (chainSelect) {
            const toggleKeySections = () => {
                const val = chainSelect.value;
                const isSolana = val === 'solana';
                const isBitcoin = val === 'bitcoin';
                const ethSection = document.getElementById('etherscan-key-section');
                const helSection = document.getElementById('helius-key-section');
                // EVM chains need Etherscan key, Solana needs Helius key, Bitcoin needs none
                if (ethSection) ethSection.style.display = (!isSolana && !isBitcoin) ? '' : 'none';
                if (helSection) helSection.style.display = isSolana ? '' : 'none';
            };
            chainSelect.addEventListener('change', toggleKeySections);
            toggleKeySections();
        }
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
    _isLinkable(s) {
        // EVM hex addresses/txids, Solana base58, Bitcoin bech32/base58
        return this._validHex(s) || /^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(s) || /^bc1[a-z0-9]{25,}$/.test(s);
    },
    addrLink(addr, explorerBase) {
        if (!addr) return '';
        const base = explorerBase || 'https://etherscan.io';
        const short = addr.slice(0, 6) + '...' + addr.slice(-4);
        if (!this._isLinkable(addr)) return '<span class="addr">' + this.esc(short) + '</span>';
        return '<span class="addr"><a href="' + this.esc(base) + '/address/' + this.esc(addr) + '" target="_blank" rel="noopener">' + this.esc(short) + '</a></span>';
    },
    addrLinkFull(addr, explorerBase) {
        if (!addr) return '';
        const base = explorerBase || 'https://etherscan.io';
        if (!this._isLinkable(addr)) return '<span class="addr">' + this.esc(addr) + '</span>';
        return '<span class="addr"><a href="' + this.esc(base) + '/address/' + this.esc(addr) + '" target="_blank" rel="noopener">' + this.esc(addr) + '</a></span>';
    },
    txLink(hash, explorerBase) {
        if (!hash) return '';
        const base = explorerBase || 'https://etherscan.io';
        const short = hash.slice(0, 10) + '...';
        if (!this._isLinkable(hash)) return '<span class="mono">' + this.esc(short) + '</span>';
        return '<a href="' + this.esc(base) + '/tx/' + this.esc(hash) + '" target="_blank" rel="noopener" class="mono">' + this.esc(short) + '</a>';
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
