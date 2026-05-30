// site/js/bitcoin-adapter.js
// BitcoinAdapter -- mempool.space API adapter for fund flow tracing.
// Implements the same interface as EvmAdapter in chain-adapter.js.
// Bitcoin uses UTXO model: transactions have multiple inputs and outputs.

const BITCOIN_CHAIN = { name: 'Bitcoin', short: 'BTC', explorer: 'https://mempool.space' };

class BitcoinAdapter {
    constructor() {
        this.chain = BITCOIN_CHAIN;
        this.apiBase = 'https://mempool.space/api';
        this._lastRequest = 0;
        this._rateLimit = 300; // ~3 req/sec
    }

    async _wait() {
        const now = Date.now();
        const elapsed = now - this._lastRequest;
        if (elapsed < this._rateLimit) await new Promise(r => setTimeout(r, this._rateLimit - elapsed));
        this._lastRequest = Date.now();
    }

    async _fetch(path) {
        await this._wait();
        const resp = await fetch(this.apiBase + path);
        if (!resp.ok) throw new Error('mempool.space API error: ' + resp.status);
        return resp.json();
    }

    // Fetch all confirmed transactions for an address
    // mempool.space: GET /api/address/{address}/txs
    // Returns array of transaction objects with vin[] and vout[]
    async _getAddressTxs(address) {
        return this._fetch('/address/' + address + '/txs');
    }

    // Convert satoshis to BTC (1 BTC = 1e8 satoshis)
    nativeToDecimal(satoshis) {
        return Number(satoshis) / 1e8;
    }

    // Map UTXO transactions to the from/to/value edge model expected by fund-flow.js
    async getNormalTxs(address) {
        const txs = await this._getAddressTxs(address);
        const results = [];

        for (const tx of txs) {
            if (!tx.status || !tx.status.confirmed) continue; // skip unconfirmed

            const timestamp = String(tx.status.block_time || 0);
            const txid = tx.txid;

            // Determine if target address appears in any input (outbound tx)
            const isInput = tx.vin.some(vin =>
                vin.prevout && vin.prevout.scriptpubkey_address === address
            );

            if (isInput) {
                // Outbound: target is spending BTC
                // Recipient = each output NOT going back to the target (skip change)
                for (const vout of tx.vout) {
                    const recipient = vout.scriptpubkey_address;
                    if (!recipient || recipient === address) continue; // skip change outputs
                    results.push({
                        from: address,
                        to: recipient,
                        value: String(vout.value), // satoshis
                        hash: txid,
                        timeStamp: timestamp,
                        isError: '0',
                    });
                }
            } else {
                // Inbound: target received BTC
                // Sender = first input address (common-input-ownership heuristic)
                const sender = (tx.vin[0] && tx.vin[0].prevout)
                    ? tx.vin[0].prevout.scriptpubkey_address : null;

                for (const vout of tx.vout) {
                    if (vout.scriptpubkey_address === address) {
                        results.push({
                            from: sender || 'coinbase',
                            to: address,
                            value: String(vout.value), // satoshis
                            hash: txid,
                            timeStamp: timestamp,
                            isError: '0',
                        });
                    }
                }
            }
        }
        return results;
    }

    // Bitcoin has no internal transactions
    async getInternalTxs() { return []; }

    // No ERC-20/token transfers on Bitcoin base layer
    async getERC20Transfers() { return []; }

    explorerUrl(type, value) {
        if (type === 'address') return this.chain.explorer + '/address/' + value;
        if (type === 'tx') return this.chain.explorer + '/tx/' + value;
        return '#';
    }
}

function getBitcoinAdapter() {
    return new BitcoinAdapter();
}
