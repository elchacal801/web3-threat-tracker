// site/js/flow-chart.js
// Transfer timeline chart for fund-flow visualization.
// All tooltip content uses DOM methods (textContent/createElement) to prevent XSS.

/* global d3, normalize, shortAddr */

var FlowChart = {
    render: function (container, edges, targetAddress) {
        if (!edges || edges.length === 0) return;

        var width = container.clientWidth || 900;
        var height = 250;
        var margin = { top: 30, right: 30, bottom: 40, left: 60 };

        // Clear previous content safely
        while (container.firstChild) container.removeChild(container.firstChild);

        // Normalize helper (handles Solana/BTC addresses that lack normalize)
        function norm(addr) {
            if (typeof normalize === 'function') {
                try { return normalize(addr); } catch (e) { /* fall through */ }
            }
            return (addr || '').trim().toLowerCase();
        }

        // Parse timestamps and classify as inbound/outbound
        var data = edges
            .map(function (e) {
                return {
                    date: new Date(Number(e.timestamp) * 1000),
                    amount: e.amount,
                    token: e.token,
                    direction: (e.to === targetAddress || norm(e.to) === norm(targetAddress)) ? 'in' : 'out',
                    txHash: e.txHash
                };
            })
            .filter(function (d) { return !isNaN(d.date.getTime()); })
            .sort(function (a, b) { return a.date - b.date; });

        if (data.length === 0) return;

        // Add x-jitter for dots at the same timestamp to reduce stacking
        var tsCounts = {};
        data.forEach(function (d) {
            var tsKey = d.date.getTime();
            if (!tsCounts[tsKey]) tsCounts[tsKey] = { count: 0 };
            d._tsIndex = tsCounts[tsKey].count;
            tsCounts[tsKey].count++;
        });
        data.forEach(function (d) {
            var tsKey = d.date.getTime();
            d._tsTotal = tsCounts[tsKey].count;
        });

        var svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        var g = svg.append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        var innerW = width - margin.left - margin.right;
        var innerH = height - margin.top - margin.bottom;

        // X scale: time
        var xScale = d3.scaleTime()
            .domain(d3.extent(data, function (d) { return d.date; }))
            .range([0, innerW]);

        // Y scale: amount
        var maxAmt = d3.max(data, function (d) { return d.amount; }) || 1;
        var yScale = d3.scaleLinear()
            .domain([0, maxAmt * 1.1])
            .range([innerH, 0]);

        // X axis
        g.append('g')
            .attr('transform', 'translate(0,' + innerH + ')')
            .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d')))
            .selectAll('text')
            .attr('fill', '#666')
            .attr('font-size', '9px');

        // Y axis
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(function (d) { return d.toFixed(4); }))
            .selectAll('text')
            .attr('fill', '#666')
            .attr('font-size', '9px');

        // Axis lines color
        g.selectAll('.domain, .tick line')
            .attr('stroke', '#222');

        // Title
        svg.append('text')
            .attr('x', margin.left)
            .attr('y', 16)
            .attr('fill', '#888')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .text('TRANSFER TIMELINE');

        // Legend
        svg.append('circle').attr('cx', width - 140).attr('cy', 12).attr('r', 4).attr('fill', '#00ff88');
        svg.append('text').attr('x', width - 132).attr('y', 16).attr('fill', '#888').attr('font-size', '9px').text('Inbound');
        svg.append('circle').attr('cx', width - 80).attr('cy', 12).attr('r', 4).attr('fill', '#ff6644');
        svg.append('text').attr('x', width - 72).attr('y', 16).attr('fill', '#888').attr('font-size', '9px').text('Outbound');

        // Data points (with x-jitter and semi-transparency for stacking)
        g.selectAll('circle')
            .data(data)
            .join('circle')
            .attr('cx', function (d) {
                if (d._tsTotal <= 1) return xScale(d.date);
                // Spread overlapping dots by +/-2px
                var jitter = (d._tsIndex - (d._tsTotal - 1) / 2) * 2;
                return xScale(d.date) + jitter;
            })
            .attr('cy', function (d) { return yScale(d.amount); })
            .attr('r', 6)
            .attr('fill', function (d) { return d.direction === 'in' ? '#00ff88' : '#ff6644'; })
            .attr('opacity', 0.7)
            .attr('stroke', '#0a0a0a')
            .attr('stroke-width', 1);

        // Tooltip (built with safe DOM methods)
        var tooltip = d3.select(container)
            .append('div')
            .style('position', 'absolute')
            .style('background', '#111')
            .style('border', '1px solid #333')
            .style('padding', '6px 10px')
            .style('font-size', '10px')
            .style('color', '#ccc')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('z-index', '10')
            .style('font-family', 'monospace');

        g.selectAll('circle')
            .on('mouseover', function (event, d) {
                tooltip.selectAll('*').remove();
                tooltip.text('');
                var div = tooltip.node();
                var line1 = document.createElement('div');
                line1.textContent = d.direction === 'in' ? 'INBOUND' : 'OUTBOUND';
                line1.style.color = d.direction === 'in' ? '#00ff88' : '#ff6644';
                line1.style.fontWeight = '600';
                div.appendChild(line1);
                var line2 = document.createElement('div');
                line2.textContent = d.amount.toFixed(6) + ' ' + (d.token || '');
                div.appendChild(line2);
                var line3 = document.createElement('div');
                line3.textContent = d.date.toISOString();
                line3.style.opacity = '0.6';
                div.appendChild(line3);
                tooltip.style('display', 'block');
            })
            .on('mousemove', function (event) {
                var rect = container.getBoundingClientRect();
                tooltip
                    .style('left', (event.clientX - rect.left + 12) + 'px')
                    .style('top', (event.clientY - rect.top - 10) + 'px');
            })
            .on('mouseout', function () { tooltip.style('display', 'none'); });
    },

    renderVolume: function (container, nodes, targetAddress) {
        if (!nodes || nodes.size === 0) return;

        // Clear previous content safely
        while (container.firstChild) container.removeChild(container.firstChild);

        // Build counterparty data, excluding the target itself
        var counterparties = [];
        nodes.forEach(function (n, addr) {
            if (addr === targetAddress) return;
            var volIn = n.volIn || 0;
            var volOut = n.volOut || 0;
            var total = volIn + volOut;
            if (total <= 0) return;
            counterparties.push({
                address: addr,
                label: n.label || (typeof shortAddr === 'function' ? shortAddr(addr) : addr),
                tag: n.tag,
                volIn: volIn,
                volOut: volOut,
                total: total
            });
        });

        // Sort by total volume descending, take top 15
        counterparties.sort(function (a, b) { return b.total - a.total; });
        counterparties = counterparties.slice(0, 15);

        if (counterparties.length === 0) return;

        var barHeight = 20;
        var margin = { top: 30, right: 80, bottom: 10, left: 160 };
        var width = container.clientWidth || 900;
        var innerW = width - margin.left - margin.right;
        var innerH = counterparties.length * barHeight;
        var height = innerH + margin.top + margin.bottom;

        var svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        var g = svg.append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        // Title
        svg.append('text')
            .attr('x', margin.left)
            .attr('y', 16)
            .attr('fill', '#888')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .text('VOLUME BY COUNTERPARTY');

        var maxTotal = d3.max(counterparties, function (d) { return d.total; }) || 1;
        var xScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([0, innerW]);

        var yScale = d3.scaleBand()
            .domain(counterparties.map(function (d) { return d.address; }))
            .range([0, innerH])
            .padding(0.15);

        // Render stacked bars: inbound (green) portion first, then outbound (orange-red)
        counterparties.forEach(function (d) {
            var y = yScale(d.address);
            var bh = yScale.bandwidth();

            // Inbound portion (funds sent TO target -- this address is a funding source)
            if (d.volIn > 0) {
                g.append('rect')
                    .attr('x', 0)
                    .attr('y', y)
                    .attr('width', xScale(d.volIn))
                    .attr('height', bh)
                    .attr('fill', '#00ff88')
                    .attr('opacity', 0.8);
            }

            // Outbound portion (funds received FROM target -- this address is a recipient)
            if (d.volOut > 0) {
                g.append('rect')
                    .attr('x', xScale(d.volIn))
                    .attr('y', y)
                    .attr('width', xScale(d.volOut))
                    .attr('height', bh)
                    .attr('fill', '#ff6644')
                    .attr('opacity', 0.8);
            }

            // Amount label at end of bar
            var amountText = d.total.toFixed(4);
            g.append('text')
                .attr('x', xScale(d.total) + 4)
                .attr('y', y + bh / 2)
                .attr('dy', '0.35em')
                .attr('fill', '#666')
                .attr('font-size', '9px')
                .attr('font-family', 'monospace')
                .text(amountText);
        });

        // Y axis labels (counterparty name/address on left)
        counterparties.forEach(function (d) {
            var y = yScale(d.address);
            var bh = yScale.bandwidth();
            var labelEl = g.append('text')
                .attr('x', -6)
                .attr('y', y + bh / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('fill', d.tag ? '#aaa' : '#666')
                .attr('font-size', '9px')
                .attr('font-family', 'monospace');
            labelEl.text(d.label);
        });

        // Small legend
        var lx = width - margin.right - 130;
        svg.append('rect').attr('x', lx).attr('y', 8).attr('width', 10).attr('height', 10).attr('fill', '#00ff88').attr('opacity', 0.8);
        svg.append('text').attr('x', lx + 14).attr('y', 17).attr('fill', '#888').attr('font-size', '9px').attr('font-family', 'monospace').text('Inbound');
        svg.append('rect').attr('x', lx + 70).attr('y', 8).attr('width', 10).attr('height', 10).attr('fill', '#ff6644').attr('opacity', 0.8);
        svg.append('text').attr('x', lx + 84).attr('y', 17).attr('fill', '#888').attr('font-size', '9px').attr('font-family', 'monospace').text('Outbound');
    }
};
