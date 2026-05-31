// site/js/flow-chart.js
// Transfer timeline chart for fund-flow visualization.
// All tooltip content uses DOM methods (textContent/createElement) to prevent XSS.

/* global d3, normalize */

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

        // Data points
        g.selectAll('circle')
            .data(data)
            .join('circle')
            .attr('cx', function (d) { return xScale(d.date); })
            .attr('cy', function (d) { return yScale(d.amount); })
            .attr('r', 5)
            .attr('fill', function (d) { return d.direction === 'in' ? '#00ff88' : '#ff6644'; })
            .attr('opacity', 0.8)
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
    }
};
