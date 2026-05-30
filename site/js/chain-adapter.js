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

    _setChain() {
        Etherscan.CHAIN_ID = this.chainId;
    }

    async getNormalTxs(address, startBlock, endBlock) {
        this._setChain();
        return Etherscan.getNormalTxs(address, startBlock, endBlock);
    }

    async getInternalTxs(address, startBlock, endBlock) {
        this._setChain();
        return Etherscan.getInternalTxs(address, startBlock, endBlock);
    }

    async getERC20Transfers(address, contractAddress) {
        this._setChain();
        return Etherscan.getERC20Transfers(address, contractAddress);
    }

    async getLogs(address, topic0, fromBlock, toBlock, extraTopics) {
        this._setChain();
        return Etherscan.getLogs(address, topic0, fromBlock, toBlock, extraTopics);
    }

    async getContractABI(address) {
        this._setChain();
        return Etherscan.getContractABI(address);
    }

    async getContractSource(address) {
        this._setChain();
        return Etherscan.getContractSource(address);
    }

    async getStorageAt(address, position) {
        this._setChain();
        return Etherscan.getStorageAt(address, position);
    }

    async ethCall(to, data) {
        this._setChain();
        return Etherscan.ethCall(to, data);
    }

    async getTxReceipt(txhash) {
        this._setChain();
        return Etherscan.getTxReceipt(txhash);
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
    if (chainId === 'solana') {
        const key = localStorage.getItem('helius_api_key') || '';
        return getSolanaAdapter(key);
    }
    return new EvmAdapter(chainId || 1);
}
