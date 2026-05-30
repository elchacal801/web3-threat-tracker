// site/js/playbooks/contract-audit.js
// Contract audit: EIP-1967 proxy detection, role tracking, upgrade history.
// Depends on: common.js, ui.js

const ContractAudit = {

    async audit(address) {
        address = normalize(address);

        // 1. EIP-1967 proxy slot checks (parallel)
        const [implSlot, adminSlot] = await Promise.all([
            Etherscan.getStorageAt(address, EIP1967.IMPLEMENTATION).catch(() => null),
            Etherscan.getStorageAt(address, EIP1967.ADMIN).catch(() => null),
        ]);

        // Slot is 32-byte hex: '0x' + 24 zero-pad chars + 40-char address
        const extractAddr = (slot) => {
            if (!slot || /^0x0*$/.test(slot)) return null;
            return '0x' + slot.slice(26).toLowerCase();
        };

        const implAddr  = extractAddr(implSlot);
        const adminAddr = extractAddr(adminSlot);
        const isProxy   = !!(implAddr || adminAddr);

        // 2. Source metadata + ABI (parallel)
        const [sourceResult, abiResult] = await Promise.all([
            Etherscan.getContractSource(address).catch(() => null),
            Etherscan.getContractABI(address).catch(() => null),
        ]);

        const src0         = Array.isArray(sourceResult) && sourceResult.length ? sourceResult[0] : null;
        const contractName = src0 ? src0.ContractName    : null;
        const compilerVer  = src0 ? src0.CompilerVersion : null;
        const isVerified   = !!(src0 && src0.ABI && src0.ABI !== 'Contract source code not verified');

        // 3. Key functions from ABI
        const KEY_FNS = ['mint','burn','grantRole','revokeRole','transferOwnership',
                         'upgradeTo','pause','unpause','blacklist','freeze','unfreeze'];
        let keyFns = [];
        if (abiResult && typeof abiResult === 'string') {
            try {
                const abi = JSON.parse(abiResult);
                keyFns = abi
                    .filter(item => item.type === 'function' && KEY_FNS.includes(item.name))
                    .map(item => ({
                        name: item.name,
                        stateMutability: item.stateMutability || 'nonpayable',
                        inputs: (item.inputs || []).map(i => i.type + (i.name ? ' ' + i.name : '')).join(', '),
                    }));
            } catch (_) { /* ABI parse error */ }
        }

        // 4. Event logs — proxy events appended conditionally
        const baseQ = [
            Etherscan.getLogs(address, EVENTS.ROLE_GRANTED).catch(() => []),
            Etherscan.getLogs(address, EVENTS.ROLE_REVOKED).catch(() => []),
            Etherscan.getLogs(address, EVENTS.OWNERSHIP_TRANSFERRED).catch(() => []),
        ];
        const proxyQ = isProxy ? [
            Etherscan.getLogs(address, EVENTS.UPGRADED).catch(() => []),
            Etherscan.getLogs(address, EVENTS.ADMIN_CHANGED).catch(() => []),
        ] : [];

        const res = await Promise.all([...baseQ, ...proxyQ]);
        const roleGrantedLogs = Array.isArray(res[0]) ? res[0] : [];
        const roleRevokedLogs = Array.isArray(res[1]) ? res[1] : [];
        const ownershipLogs   = Array.isArray(res[2]) ? res[2] : [];
        const upgradedLogs    = isProxy && Array.isArray(res[3]) ? res[3] : [];

        // 5. Parse role events (topics[1]=roleHash, topics[2]=account, topics[3]=sender)
        const parseRole = (log) => {
            const t = log.topics || [];
            return {
                blockNumber: parseInt(log.blockNumber, 16),
                txHash:   log.transactionHash,
                roleHash: t[1] || null,
                roleName: t[1] ? (ROLES[t[1]] || t[1]) : null,
                account:  t[2] ? topicToAddr(t[2]) : null,
                sender:   t[3] ? topicToAddr(t[3]) : null,
            };
        };

        const allRoleEvents = [
            ...roleGrantedLogs.map(l => ({ ...parseRole(l), action: 'granted' })),
            ...roleRevokedLogs.map(l => ({ ...parseRole(l), action: 'revoked'  })),
        ].sort((a, b) => a.blockNumber - b.blockNumber);

        // 6. Compute current roles: roleHash -> Set<account>
        const currentRoles = {};
        for (const ev of allRoleEvents) {
            if (!currentRoles[ev.roleHash]) currentRoles[ev.roleHash] = new Set();
            if (ev.action === 'granted') currentRoles[ev.roleHash].add(ev.account);
            else                         currentRoles[ev.roleHash].delete(ev.account);
        }

        // 7. Ownership history (topics[1]=previousOwner, topics[2]=newOwner)
        const ownershipEvents = ownershipLogs.map(log => {
            const t = log.topics || [];
            return {
                blockNumber:   parseInt(log.blockNumber, 16),
                txHash:        log.transactionHash,
                previousOwner: t[1] ? topicToAddr(t[1]) : null,
                newOwner:      t[2] ? topicToAddr(t[2]) : null,
            };
        }).sort((a, b) => a.blockNumber - b.blockNumber);

        const currentOwner = ownershipEvents.length
            ? ownershipEvents[ownershipEvents.length - 1].newOwner : null;

        // 8. Upgrade history (topics[1] = new implementation address)
        const upgradeEvents = upgradedLogs.map(log => {
            const t = log.topics || [];
            return {
                blockNumber: parseInt(log.blockNumber, 16),
                txHash:      log.transactionHash,
                newImpl:     t[1] ? topicToAddr(t[1]) : null,
            };
        }).sort((a, b) => a.blockNumber - b.blockNumber);

        // 9. Render results
        this._render(address, {
            isProxy, implAddr, adminAddr,
            contractName, compilerVer, isVerified,
            keyFns, currentRoles, allRoleEvents,
            ownershipEvents, currentOwner, upgradeEvents,
        });
    },

    _render(address, d) {
        const el = document.getElementById('results');
        if (!el) return;

        const HIGH_RISK = new Set(['mint','burn','blacklist','freeze','upgradeTo']);
        const EM = '\u2014';
        const parts = [];

        // Contract Info Panel
        let r = '';
        r += '<tr><td><strong>Address</strong></td><td>'         + UI.addrLinkFull(address) + '</td></tr>';
        r += '<tr><td><strong>Name</strong></td><td>'            + (d.contractName ? UI.esc(d.contractName) : '<em>unverified / unknown</em>') + '</td></tr>';
        r += '<tr><td><strong>Compiler</strong></td><td>'        + (d.compilerVer  ? UI.esc(d.compilerVer)  : 'N/A') + '</td></tr>';
        r += '<tr><td><strong>Source verified</strong></td><td>' + (d.isVerified ? UI.severityBadge('Legitimate') : UI.severityBadge('Suspicious')) + '</td></tr>';
        r += '<tr><td><strong>Proxy (EIP-1967)</strong></td><td>'+ (d.isProxy    ? UI.severityBadge('Risky')      : 'No') + '</td></tr>';
        if (d.implAddr)     r += '<tr><td><strong>Implementation</strong></td><td>' + UI.addrLinkFull(d.implAddr)     + '</td></tr>';
        if (d.adminAddr)    r += '<tr><td><strong>Proxy Admin</strong></td><td>'    + UI.addrLinkFull(d.adminAddr)    + '</td></tr>';
        if (d.currentOwner) r += '<tr><td><strong>Current Owner</strong></td><td>' + UI.addrLinkFull(d.currentOwner) + '</td></tr>';
        parts.push('<div class="detail-panel"><h3>Contract Info</h3><table><tbody>' + r + '</tbody></table></div>');

        // Key Functions
        if (d.keyFns.length > 0) {
            let rows = '';
            for (const fn of d.keyFns) {
                rows += '<tr>'
                    + '<td class="mono">' + (HIGH_RISK.has(fn.name) ? UI.severityBadge('Risky') + ' ' : '') + UI.esc(fn.name) + '</td>'
                    + '<td class="mono">' + UI.esc(fn.stateMutability) + '</td>'
                    + '<td class="mono">' + UI.esc(fn.inputs || EM) + '</td>'
                    + '</tr>';
            }
            parts.push('<div class="detail-panel"><h3>Key Functions Detected</h3>'
                + '<div class="results-table-wrap"><table>'
                + '<thead><tr><th>Function</th><th>Mutability</th><th>Inputs</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div></div>');
        } else {
            parts.push('<div class="detail-panel"><p><em>'
                + (d.isVerified ? 'No high-interest functions found in ABI.'
                                : 'Contract source not verified \u2014 ABI unavailable.')
                + '</em></p></div>');
        }

        // Current Role Holders
        const activeRows = [];
        for (const [rh, accounts] of Object.entries(d.currentRoles)) {
            for (const acct of accounts) activeRows.push({ role: ROLES[rh] || rh, account: acct });
        }
        if (activeRows.length > 0) {
            let rows = '';
            for (const row of activeRows) {
                const tag = tagAddress(row.account);
                rows += '<tr>'
                    + '<td class="mono">' + UI.esc(row.role) + '</td>'
                    + '<td>' + UI.addrLink(row.account) + (tag ? ' <span class="tag-pill">' + UI.esc(tag.name) + '</span>' : '') + '</td>'
                    + '</tr>';
            }
            parts.push('<div class="detail-panel"><h3>Current Role Holders (' + UI.esc(activeRows.length) + ')</h3>'
                + '<div class="results-table-wrap"><table>'
                + '<thead><tr><th>Role</th><th>Account</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div></div>');
        }

        // Role Event History
        if (d.allRoleEvents.length > 0) {
            let rows = '';
            for (const ev of d.allRoleEvents) {
                const tag = ev.account ? tagAddress(ev.account) : null;
                rows += '<tr>'
                    + '<td class="mono">' + UI.esc(ev.blockNumber) + '</td>'
                    + '<td>' + UI.severityBadge(ev.action === 'granted' ? 'Granted' : 'Revoked') + '</td>'
                    + '<td class="mono">' + UI.esc(ev.roleName || EM) + '</td>'
                    + '<td>' + (ev.account ? UI.addrLink(ev.account) : EM) + (tag ? ' <span class="tag-pill">' + UI.esc(tag.name) + '</span>' : '') + '</td>'
                    + '<td>' + (ev.sender  ? UI.addrLink(ev.sender)  : EM) + '</td>'
                    + '<td>' + (ev.txHash  ? UI.txLink(ev.txHash)    : EM) + '</td>'
                    + '</tr>';
            }
            parts.push('<div class="detail-panel"><h3>Role Event History (' + UI.esc(d.allRoleEvents.length) + ')</h3>'
                + '<div class="results-table-wrap"><table>'
                + '<thead><tr><th>Block</th><th>Action</th><th>Role</th><th>Account</th><th>Sender</th><th>Tx</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div></div>');
        }

        // Ownership History
        if (d.ownershipEvents.length > 0) {
            let rows = '';
            for (const ev of d.ownershipEvents) {
                rows += '<tr>'
                    + '<td class="mono">' + UI.esc(ev.blockNumber) + '</td>'
                    + '<td>' + (ev.previousOwner ? UI.addrLink(ev.previousOwner) : EM) + '</td>'
                    + '<td>' + (ev.newOwner      ? UI.addrLink(ev.newOwner)      : EM) + '</td>'
                    + '<td>' + (ev.txHash        ? UI.txLink(ev.txHash)          : EM) + '</td>'
                    + '</tr>';
            }
            parts.push('<div class="detail-panel"><h3>Ownership History (' + UI.esc(d.ownershipEvents.length) + ')</h3>'
                + '<div class="results-table-wrap"><table>'
                + '<thead><tr><th>Block</th><th>Previous Owner</th><th>New Owner</th><th>Tx</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div></div>');
        }

        // Upgrade History (proxy only)
        if (d.upgradeEvents.length > 0) {
            let rows = '';
            for (const ev of d.upgradeEvents) {
                rows += '<tr>'
                    + '<td class="mono">' + UI.esc(ev.blockNumber) + '</td>'
                    + '<td>' + (ev.newImpl ? UI.addrLinkFull(ev.newImpl) : EM) + '</td>'
                    + '<td>' + (ev.txHash  ? UI.txLink(ev.txHash)        : EM) + '</td>'
                    + '</tr>';
            }
            parts.push('<div class="detail-panel"><h3>' + UI.severityBadge('Risky')
                + ' Upgrade History (' + UI.esc(d.upgradeEvents.length) + ')</h3>'
                + '<div class="results-table-wrap"><table>'
                + '<thead><tr><th>Block</th><th>New Implementation</th><th>Tx</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div></div>');
        } else if (d.isProxy) {
            parts.push('<div class="detail-panel"><p><em>No upgrade events found for this proxy.</em></p></div>');
        }

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
            await ContractAudit.audit(address);
        } catch (err) {
            UI.showError(err.message || String(err));
        }
    });
});
