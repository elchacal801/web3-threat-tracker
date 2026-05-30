// site/js/solana-adapter.js
// SolanaAdapter -- Helius Enhanced Transactions API adapter for fund flow tracing.
// Implements the same interface as EvmAdapter in chain-adapter.js.

const SOLANA_CHAINS = {
    'solana': { name: 'Solana', short: 'SOL', explorer: 'https://solscan.io' },
};

// Known Solana program IDs and entities
const SOLANA_KNOWN = {
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': { name: 'Jupiter V6', type: 'dex' },
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': { name: 'Jupiter V4', type: 'dex' },
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { name: 'Raydium AMM', type: 'dex' },
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': { name: 'Raydium CLMM', type: 'dex' },
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': { name: 'Orca Whirlpool', type: 'dex' },
    '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': { name: 'Orca Swap V2', type: 'dex' },
    'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb': { name: 'Wormhole', type: 'bridge' },
    'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth': { name: 'Wormhole Token Bridge', type: 'bridge' },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'Marinade Finance', type: 'defi' },
    'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': { name: 'Marinade Native', type: 'defi' },
    'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': { name: 'Orca Token Swap', type: 'dex' },
    'So11111111111111111111111111111111111111112': { name: 'Wrapped SOL', type: 'token' },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USDC (Solana)', type: 'token' },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'USDT (Solana)', type: 'token' },
    '11111111111111111111111111111111': { name: 'System Program', type: 'system' },
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'Token Program', type: 'system' },
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': { name: 'Associated Token Program', type: 'system' },
};

class SolanaAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.chain = SOLANA_CHAINS['solana'];
        this._lastRequest = 0;
        this._rateLimit = 500; // 2 req/sec on free tier
        this._txCache = {};
    }

    async _wait() {
        const now = Date.now();
        const elapsed = now - this._lastRequest;
        if (elapsed < this._rateLimit) await new Promise(r => setTimeout(r, this._rateLimit - elapsed));
        this._lastRequest = Date.now();
    }

    async _fetchTransactions(address, limit = 100) {
        if (!this.apiKey) throw new Error('Helius API key required for Solana tracing.');
        await this._wait();
        const url = 'https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(this.apiKey);
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTransactionsForAddress',
                params: [address, { limit, sortOrder: 'asc' }],
            }),
        });
        if (!resp.ok) throw new Error('Helius API error: ' + resp.status);
        const data = await resp.json();
        if (data.error) throw new Error('Helius: ' + (data.error.message || JSON.stringify(data.error)));
        return data.result || [];
    }

    async _getOrFetchTxs(address) {
        if (this._txCache[address]) return this._txCache[address];
        const txs = await this._fetchTransactions(address, 100);
        this._txCache[address] = txs;
        return txs;
    }

    // Convert native amount to human-readable decimal (1 SOL = 1e9 lamports)
    nativeToDecimal(value) { return Number(value) / 1e9; }

    // Match EvmAdapter interface -- getNormalTxs returns SOL transfers
    async getNormalTxs(address) {
        const txs = await this._getOrFetchTxs(address);
        const results = [];
        for (const tx of txs) {
            for (const nt of (tx.nativeTransfers || [])) {
                if (nt.fromUserAccount === address || nt.toUserAccount === address) {
                    results.push({
                        from: nt.fromUserAccount,
                        to: nt.toUserAccount,
                        value: String(nt.amount), // lamports
                        hash: tx.signature,
                        timeStamp: String(tx.timestamp || 0),
                        isError: '0',
                    });
                }
            }
        }
        return results;
    }

    // Solana has no internal tx concept
    async getInternalTxs() {
        return [];
    }

    // getERC20Transfers -- maps to SPL token transfers
    async getERC20Transfers(address) {
        const txs = await this._getOrFetchTxs(address);
        const results = [];
        for (const tx of txs) {
            for (const tt of (tx.tokenTransfers || [])) {
                if (tt.fromUserAccount === address || tt.toUserAccount === address) {
                    results.push({
                        from: tt.fromUserAccount || '',
                        to: tt.toUserAccount || '',
                        value: String(tt.tokenAmount || 0),
                        tokenSymbol: tt.tokenStandard || 'SPL',
                        tokenDecimal: String(tt.tokenDecimals || 0),
                        contractAddress: tt.mint || '',
                        hash: tx.signature,
                        timeStamp: String(tx.timestamp || 0),
                    });
                }
            }
        }
        return results;
    }

    explorerUrl(type, value) {
        if (type === 'address') return this.chain.explorer + '/account/' + value;
        if (type === 'tx') return this.chain.explorer + '/tx/' + value;
        return '#';
    }
}

function getSolanaAdapter(apiKey) {
    return new SolanaAdapter(apiKey);
}
