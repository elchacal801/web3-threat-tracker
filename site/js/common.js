// site/js/common.js
const Etherscan = {
    BASE_URL: 'https://api.etherscan.io/v2/api',
    CHAIN_ID: 1,
    _lastRequest: 0,
    _rateLimit: 220,

    async _wait() {
        const now = Date.now();
        const elapsed = now - this._lastRequest;
        if (elapsed < this._rateLimit) await new Promise(r => setTimeout(r, this._rateLimit - elapsed));
        this._lastRequest = Date.now();
    },

    async call(module, action, params = {}) {
        const apiKey = UI.getApiKey();
        if (!apiKey) throw new Error('Etherscan API key required. Enter your key above.');
        this._rateLimit = 220;
        await this._wait();
        const url = new URL(this.BASE_URL);
        url.searchParams.set('chainid', this.CHAIN_ID);
        url.searchParams.set('module', module);
        url.searchParams.set('action', action);
        url.searchParams.set('apikey', apiKey);
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, v);
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Etherscan API error: ' + resp.status);
        const data = await resp.json();
        if (data.message && (data.message.includes('rate limit') || data.message.includes('Max rate'))) {
            await new Promise(r => setTimeout(r, 2000));
            return this.call(module, action, params);
        }
        if (data.status === '0' && (data.message === 'No transactions found' || data.message === 'No records found')) return [];
        if (data.status === '0' && data.result === 'Max rate limit reached') {
            await new Promise(r => setTimeout(r, 2000));
            return this.call(module, action, params);
        }
        return data.result;
    },

    _MAX_RESULTS: 10000,

    _markTruncation(results) {
        if (Array.isArray(results) && results.length >= this._MAX_RESULTS) {
            results._truncated = true;
        }
        return results;
    },

    async getNormalTxs(address, startBlock, endBlock) {
        startBlock = startBlock || 0; endBlock = endBlock || 99999999;
        const r = await this.call('account', 'txlist', { address, startblock: startBlock, endblock: endBlock, sort: 'asc', page: 1, offset: this._MAX_RESULTS });
        return this._markTruncation(r);
    },
    async getInternalTxs(address, startBlock, endBlock) {
        startBlock = startBlock || 0; endBlock = endBlock || 99999999;
        const r = await this.call('account', 'txlistinternal', { address, startblock: startBlock, endblock: endBlock, sort: 'asc', page: 1, offset: this._MAX_RESULTS });
        return this._markTruncation(r);
    },
    async getERC20Transfers(address, contractAddress) {
        const params = { address, sort: 'asc', page: 1, offset: this._MAX_RESULTS };
        if (contractAddress) params.contractaddress = contractAddress;
        const r = await this.call('account', 'tokentx', params);
        return this._markTruncation(r);
    },
    async getLogs(address, topic0, fromBlock, toBlock, extraTopics) {
        fromBlock = fromBlock || 0; toBlock = toBlock || 'latest';
        const params = { address, topic0, fromBlock, toBlock };
        if (extraTopics) Object.assign(params, extraTopics);
        return this.call('logs', 'getLogs', params);
    },
    async getContractABI(address) { return this.call('contract', 'getabi', { address }); },
    async getContractSource(address) { return this.call('contract', 'getsourcecode', { address }); },
    async getStorageAt(address, position) { return this.call('proxy', 'eth_getStorageAt', { address, position, tag: 'latest' }); },
    async ethCall(to, data) { return this.call('proxy', 'eth_call', { to, data, tag: 'latest' }); },
    async getTxReceipt(txhash) { return this.call('proxy', 'eth_getTransactionReceipt', { txhash }); },
};

const KNOWN_ADDRESSES = {
    '0x28c6c06298d514db089934071355e5743bf21d60': { name: 'Binance 14', type: 'cex' },
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { name: 'Binance 15', type: 'cex' },
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { name: 'Binance 16', type: 'cex' },
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': { name: 'Binance 17', type: 'cex' },
    '0x9696f59e4d72e237be84ffd425dcad154bf96976': { name: 'Binance 18', type: 'cex' },
    '0x4976a4a02f38326660d17bf34b431dc6e2eb2327': { name: 'Binance 19', type: 'cex' },
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { name: 'Coinbase 1', type: 'cex' },
    '0x503828976d22510aad0201ac7ec88293211d23da': { name: 'Coinbase 2', type: 'cex' },
    '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': { name: 'Coinbase 3', type: 'cex' },
    '0x3cd751e6b0078be393132286c442345e68ff0afc': { name: 'Coinbase 4', type: 'cex' },
    '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': { name: 'Coinbase 5', type: 'cex' },
    '0xeb2629a2734e272bcc07bda959863f316f4bd4cf': { name: 'Coinbase 6', type: 'cex' },
    '0x02466e547bfdab679fc49e96bbfc62b9747d997c': { name: 'Coinbase 7', type: 'cex' },
    '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { name: 'Coinbase 8', type: 'cex' },
    '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2': { name: 'FTX', type: 'cex' },
    '0xc098b2a3aa256d2140208c3de6543aaef5cd3a94': { name: 'FTX 2', type: 'cex' },
    '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': { name: 'Kraken 4', type: 'cex' },
    '0xfa52274dd61e1643d2205169732f29114bc240b3': { name: 'Kraken 5', type: 'cex' },
    '0xae2d4617c862309a3d75a0ffb358c7a5009c673f': { name: 'Kraken 6', type: 'cex' },
    '0x0d0707963952f2fba59dd06f2b425ace40b492fe': { name: 'Gate.io 1', type: 'cex' },
    '0x7793cd85c11a924478d358d49b05b37e91b5810f': { name: 'Gate.io 2', type: 'cex' },
    '0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23': { name: 'Gate.io 3', type: 'cex' },
    '0xd24400ae8bfebb18ca49be86258a3c749cf46853': { name: 'Gemini 4', type: 'cex' },
    '0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8': { name: 'KuCoin', type: 'cex' },
    '0x49048044d57e1c92a77f79988d21fa8faf74e97e': { name: 'Base Bridge', type: 'bridge' },
    '0x3ee18b2214aff97000d974cf647e7c347e8fa585': { name: 'Wormhole', type: 'bridge' },
    '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf': { name: 'Polygon Bridge', type: 'bridge' },
    '0xa0c68c638235ee32657e8f720a23cec1bfc6c9a8': { name: 'Polygon ERC20 Bridge', type: 'bridge' },
    '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a': { name: 'Arbitrum Bridge', type: 'bridge' },
    '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1': { name: 'Optimism Bridge', type: 'bridge' },
    '0x3014ca10b91cb3d0ad85fef7a3cb95bcac9c0f79': { name: 'Stargate Finance', type: 'bridge' },
    '0xbd3fa81b58ba92a82136038b25adec7066af3155': { name: 'CCTP TokenMessenger', type: 'bridge' },
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2 Router', type: 'dex' },
    '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'Uniswap V3 Router', type: 'dex' },
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap V3 Router 2', type: 'dex' },
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { name: 'Uniswap Universal Router', type: 'dex' },
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': { name: 'SushiSwap Router', type: 'dex' },
    '0x1111111254eeb25477b68fb85ed929f73a960582': { name: '1inch V5', type: 'dex' },
    '0x1111111254fb6c44bac0bed2854e76f90643097d': { name: '1inch V4', type: 'dex' },
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { name: '0x Exchange', type: 'dex' },
    '0xbebc44782c7db0a1a60cb6fe97d0b483032f535c': { name: 'Curve 3pool', type: 'dex' },
    '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': { name: 'Tornado Cash Router', type: 'mixer' },
    '0x722122df12d4e14e13ac3b6895a86e84145b6967': { name: 'Tornado Cash Proxy', type: 'mixer' },
    '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': { name: 'Tornado Cash 0.1 ETH', type: 'mixer' },
    '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { name: 'Tornado Cash 1 ETH', type: 'mixer' },
    '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { name: 'Tornado Cash 10 ETH', type: 'mixer' },
    '0xa160cdab225685da1d56aa342ad8841c3b53f291': { name: 'Tornado Cash 100 ETH', type: 'mixer' },
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'USDC', type: 'token' },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'USDT', type: 'token' },
    '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'DAI', type: 'token' },
};

const EVENTS = {
    TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ROLE_GRANTED: '0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d',
    ROLE_REVOKED: '0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b',
    OWNERSHIP_TRANSFERRED: '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
    UPGRADED: '0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b',
    ADMIN_CHANGED: '0x7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f',
    MESSAGE_RECEIVED: '0x58200b4c34ae05ee816d710053fff3fb75af4395915d3d2a771b24aa10132d80',
    MINT_AND_WITHDRAW: '0x1b2a7ff080b8cb6ff436ce0372e399692b691b2a6f1e64f22a2e4607c2772513',
};

const ROLES = {
    '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6': 'MINTER_ROLE',
    '0x0000000000000000000000000000000000000000000000000000000000000000': 'DEFAULT_ADMIN_ROLE',
    '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a': 'PAUSER_ROLE',
};

const CCTP = {
    TOKEN_MESSENGER: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
    MESSAGE_TRANSMITTER: '0x0a992d191deec32afe36203ad87d7d289a738f81',
    DOMAINS: { 0: 'Ethereum', 1: 'Avalanche', 2: 'Optimism', 3: 'Arbitrum', 4: 'Noble', 5: 'Solana', 6: 'Base', 7: 'Polygon' },
};

let _labelsLoaded = false;

async function loadLabels() {
    if (_labelsLoaded) return;
    try {
        const resp = await fetch('data/labels.json');
        if (resp.ok) {
            const data = await resp.json();
            for (const [addr, info] of Object.entries(data)) {
                KNOWN_ADDRESSES[addr] = info;
            }
        }
    } catch (e) { /* fall back to static KNOWN_ADDRESSES */ }
    _labelsLoaded = true;
}

function normalize(addr) {
    if (!addr) return '';
    addr = addr.toLowerCase().trim();
    if (!addr.startsWith('0x')) addr = '0x' + addr;
    return addr;
}
function tagAddress(addr) {
    if (typeof SOLANA_KNOWN !== 'undefined' && addr && SOLANA_KNOWN[addr.trim()]) return SOLANA_KNOWN[addr.trim()];
    return KNOWN_ADDRESSES[normalize(addr)] || null;
}
function isNullAddress(addr) { return normalize(addr) === '0x0000000000000000000000000000000000000000'; }
function weiToEth(wei) { return Number(wei) / 1e18; }
function weiToToken(wei, decimals) { decimals = decimals || 18; return Number(wei) / Math.pow(10, decimals); }
function shortAddr(addr) { if (!addr || addr.length < 10) return addr || ''; return addr.slice(0, 6) + '...' + addr.slice(-4); }
function tsToISO(ts) { return new Date(Number(ts) * 1000).toISOString(); }
function topicToAddr(topic) { if (!topic || topic.length < 26) return ''; return '0x' + topic.slice(26).toLowerCase(); }

const EIP1967 = {
    IMPLEMENTATION: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    ADMIN: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
};
