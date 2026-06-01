// site/js/chain-adapter.js
// ChainAdapter abstraction -- parameterises Etherscan calls by chainId
// so analytic playbooks are not hard-wired to Ethereum mainnet.

const EVM_CHAINS = {
    1:     { name: 'Ethereum',  short: 'ETH',   explorer: 'https://etherscan.io' },
    56:    { name: 'BSC',       short: 'BSC',   explorer: 'https://bscscan.com' },
    137:   { name: 'Polygon',   short: 'MATIC', explorer: 'https://polygonscan.com' },
    42161: { name: 'Arbitrum',  short: 'ARB',   explorer: 'https://arbiscan.io' },
    8453:  { name: 'Base',      short: 'BASE',  explorer: 'https://basescan.org' },
    10:    { name: 'Optimism',  short: 'OP',    explorer: 'https://optimistic.etherscan.io' },
};

class EvmAdapter {
    constructor(chainId) {
        this.chainId = chainId;
        this.chain = EVM_CHAINS[chainId] || EVM_CHAINS[1];
    }

    async getNormalTxs(address, startBlock, endBlock) {
        startBlock = startBlock || 0; endBlock = endBlock || 99999999;
        const r = await Etherscan.call('account', 'txlist', { address, startblock: startBlock, endblock: endBlock, sort: 'asc', page: 1, offset: Etherscan._MAX_RESULTS }, this.chainId);
        return Etherscan._markTruncation(r);
    }

    async getInternalTxs(address, startBlock, endBlock) {
        startBlock = startBlock || 0; endBlock = endBlock || 99999999;
        const r = await Etherscan.call('account', 'txlistinternal', { address, startblock: startBlock, endblock: endBlock, sort: 'asc', page: 1, offset: Etherscan._MAX_RESULTS }, this.chainId);
        return Etherscan._markTruncation(r);
    }

    async getERC20Transfers(address, contractAddress) {
        const params = { address, sort: 'asc', page: 1, offset: Etherscan._MAX_RESULTS };
        if (contractAddress) params.contractaddress = contractAddress;
        const r = await Etherscan.call('account', 'tokentx', params, this.chainId);
        return Etherscan._markTruncation(r);
    }

    async getLogs(address, topic0, fromBlock, toBlock, extraTopics) {
        fromBlock = fromBlock || 0; toBlock = toBlock || 'latest';
        const params = { address, topic0, fromBlock, toBlock };
        if (extraTopics) Object.assign(params, extraTopics);
        return Etherscan.call('logs', 'getLogs', params, this.chainId);
    }

    async getContractABI(address) {
        return Etherscan.call('contract', 'getabi', { address }, this.chainId);
    }

    async getContractSource(address) {
        return Etherscan.call('contract', 'getsourcecode', { address }, this.chainId);
    }

    async getStorageAt(address, position) {
        return Etherscan.call('proxy', 'eth_getStorageAt', { address, position, tag: 'latest' }, this.chainId);
    }

    async ethCall(to, data) {
        return Etherscan.call('proxy', 'eth_call', { to, data, tag: 'latest' }, this.chainId);
    }

    async getTxReceipt(txhash) {
        return Etherscan.call('proxy', 'eth_getTransactionReceipt', { txhash }, this.chainId);
    }

    // Convert native amount to human-readable decimal (1 ETH = 1e18 wei)
    nativeToDecimal(value) { return Number(value) / 1e18; }

    explorerUrl(type, value) {
        if (type === 'address') return this.chain.explorer + '/address/' + value;
        if (type === 'tx')      return this.chain.explorer + '/tx/' + value;
        return '#';
    }
}

function getAdapter(chainId) {
    if (chainId === 'bitcoin') return getBitcoinAdapter();
    if (chainId === 'solana') {
        const key = localStorage.getItem('helius_api_key') || '';
        return getSolanaAdapter(key);
    }
    return new EvmAdapter(chainId || 1);
}
