// site/js/flow-graph.js
// Interactive D3 force-directed network graph for fund-flow visualization.
// All user data in tooltips is escaped via _flowGraphEsc (textContent-based)
// to prevent XSS.

/* global d3, shortAddr */

function _flowGraphEsc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
}

var FlowGraph = {

    render: function (container, nodes, edges, adapter) {
        var width = container.clientWidth || 900;
        var height = 600;

        // Clear previous content
        container.innerHTML = '';

        // --- SVG setup ---
        var svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height]);

        // Zoom layer
        var g = svg.append('g');
        svg.call(d3.zoom()
            .scaleExtent([0.3, 5])
            .on('zoom', function (event) { g.attr('transform', event.transform); }));

        // --- Prepare data ---
        var nodeArray = Array.from(nodes.values()).map(function (n) {
            return {
                id: n.address,
                label: n.label || (typeof shortAddr === 'function' ? shortAddr(n.address) : n.address),
                type: n.type,
                vol: (n.volIn || 0) + (n.volOut || 0),
                volIn: n.volIn || 0,
                volOut: n.volOut || 0,
                address: n.address,
                tag: n.tag
            };
        });

        var linkArray = edges.map(function (e) {
            return {
                source: e.from,
                target: e.to,
                amount: e.amount,
                token: e.token,
                txHash: e.txHash
            };
        });

        // Build a set of node ids for link filtering
        var nodeIds = new Set(nodeArray.map(function (n) { return n.id; }));
        linkArray = linkArray.filter(function (l) {
            return nodeIds.has(l.source) && nodeIds.has(l.target);
        });

        if (nodeArray.length === 0) return;

        // --- Scales ---
        var maxVol = Math.max.apply(null, nodeArray.map(function (n) { return n.vol; }).concat([0.001]));
        var rScale = d3.scaleSqrt().domain([0, maxVol]).range([6, 28]);

        var maxAmt = Math.max.apply(null, linkArray.map(function (l) { return l.amount; }).concat([0.001]));
        var wScale = d3.scaleLinear().domain([0, maxAmt]).range([1.5, 4]);

        var typeColor = {
            target: '#00ff88',
            cex: '#00aaff',
            dex: '#aa00ff',
            bridge: '#ffaa00',
            mixer: '#ff2222',
            external: '#444444',
            defi: '#00ddaa',
            token: '#333333',
            system: '#333333',
            sanctioned: '#ff2222'
        };

        // Build lookup for node types by address
        var nodeTypeMap = {};
        nodeArray.forEach(function (n) { nodeTypeMap[n.id] = n.type; });

        function edgeColor(d) {
            var tgtType = nodeTypeMap[typeof d.target === 'object' ? d.target.id : d.target];
            if (tgtType === 'mixer') return '#ff2222';
            if (tgtType === 'cex' || tgtType === 'bridge') return '#00ff88';
            return '#333';
        }

        // --- Compute edge indices for multi-edge pairs ---
        // For each pair (source,target), assign an index so we can curve parallel edges
        var pairCount = {};
        linkArray.forEach(function (l) {
            var sId = typeof l.source === 'object' ? l.source.id : l.source;
            var tId = typeof l.target === 'object' ? l.target.id : l.target;
            var pairKey = sId < tId ? sId + '|' + tId : tId + '|' + sId;
            if (!pairCount[pairKey]) pairCount[pairKey] = { count: 0 };
            l._pairKey = pairKey;
            l._pairIndex = pairCount[pairKey].count;
            pairCount[pairKey].count++;
        });
        // Store total count on each link
        linkArray.forEach(function (l) {
            l._pairTotal = pairCount[l._pairKey].count;
        });

        // Arrow markers -- create per-color with dynamic refX
        var defs = svg.append('defs');
        var defaultColors = { default: '#555', exit: '#00ff88', mixer: '#ff2222' };
        // Create markers for a range of refX values (keyed by radius bucket)
        var markerCache = {};
        function getMarkerId(colorKey, targetRadius) {
            var rBucket = Math.round(targetRadius);
            var key = colorKey + '-' + rBucket;
            if (!markerCache[key]) {
                var refX = rBucket + 8;
                defs.append('marker')
                    .attr('id', 'arrow-' + key)
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', refX)
                    .attr('refY', 0)
                    .attr('markerWidth', 8)
                    .attr('markerHeight', 8)
                    .attr('orient', 'auto')
                    .append('path')
                    .attr('d', 'M0,-5L10,0L0,5')
                    .attr('fill', defaultColors[colorKey]);
                markerCache[key] = true;
            }
            return 'url(#arrow-' + key + ')';
        }

        // Node volume map for radius lookup
        var nodeVolMap = {};
        nodeArray.forEach(function (n) { nodeVolMap[n.id] = n.vol; });

        function edgeMarker(d) {
            var tgtId = typeof d.target === 'object' ? d.target.id : d.target;
            var tgtType = nodeTypeMap[tgtId];
            var tgtRadius = rScale(nodeVolMap[tgtId] || 0);
            var colorKey = 'default';
            if (tgtType === 'mixer') colorKey = 'mixer';
            else if (tgtType === 'cex' || tgtType === 'bridge') colorKey = 'exit';
            return getMarkerId(colorKey, tgtRadius);
        }

        // --- Force simulation (increased spacing) ---
        var simulation = d3.forceSimulation(nodeArray)
            .force('link', d3.forceLink(linkArray).id(function (d) { return d.id; }).distance(160))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide().radius(function (d) { return rScale(d.vol) + 10; }));

        // --- Render links as paths (curved for multi-edges) ---
        var link = g.append('g')
            .attr('class', 'flow-links')
            .selectAll('path')
            .data(linkArray)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', edgeColor)
            .attr('stroke-width', function (d) { return wScale(d.amount); })
            .attr('stroke-opacity', 0.7)
            .attr('marker-end', edgeMarker);

        // --- Render nodes ---
        var node = g.append('g')
            .attr('class', 'flow-nodes')
            .selectAll('circle')
            .data(nodeArray)
            .join('circle')
            .attr('r', function (d) { return rScale(d.vol); })
            .attr('fill', function (d) { return typeColor[d.type] || '#444444'; })
            .attr('stroke', '#0a0a0a')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', dragStart)
                .on('drag', dragging)
                .on('end', dragEnd));

        // --- Labels ---
        var labels = g.append('g')
            .attr('class', 'flow-labels')
            .selectAll('text')
            .data(nodeArray)
            .join('text')
            .text(function (d) { return d.label; })
            .attr('font-size', '10px')
            .attr('fill', function (d) { return d.tag ? '#aaa' : '#666'; })
            .attr('font-family', 'monospace')
            .attr('dx', function (d) { return rScale(d.vol) + 4; })
            .attr('dy', 3);

        // --- Tooltip (built with safe DOM methods, content set via _flowGraphEsc) ---
        var tooltip = d3.select(container)
            .append('div')
            .style('position', 'absolute')
            .style('background', '#111')
            .style('border', '1px solid #333')
            .style('padding', '6px 10px')
            .style('font-size', '11px')
            .style('color', '#ccc')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('z-index', '10')
            .style('max-width', '300px')
            .style('font-family', 'monospace')
            .style('line-height', '1.5')
            .style('border-radius', '2px');

        function showNodeTooltip(d) {
            var el = tooltip.node();
            el.textContent = '';
            var b = document.createElement('strong');
            b.textContent = d.label;
            el.appendChild(b);
            el.appendChild(document.createElement('br'));
            _appendTooltipLine(el, 'Address', d.address);
            _appendTooltipLine(el, 'Type', d.type);
            _appendTooltipLine(el, 'Vol in', d.volIn.toFixed(4));
            _appendTooltipLine(el, 'Vol out', d.volOut.toFixed(4));
            tooltip.style('display', 'block');
        }

        function showEdgeTooltip(d) {
            var el = tooltip.node();
            el.textContent = '';
            _appendTooltipLine(el, 'Amount', d.amount.toFixed(6) + ' ' + d.token);
            _appendTooltipLine(el, 'Tx', d.txHash);
            tooltip.style('display', 'block');
        }

        function _appendTooltipLine(el, label, value) {
            var span = document.createElement('span');
            span.style.color = '#666';
            span.textContent = label + ': ';
            el.appendChild(span);
            el.appendChild(document.createTextNode(String(value)));
            el.appendChild(document.createElement('br'));
        }

        function positionTooltip(event) {
            var rect = container.getBoundingClientRect();
            tooltip
                .style('left', (event.clientX - rect.left + 12) + 'px')
                .style('top', (event.clientY - rect.top - 10) + 'px');
        }

        // Node hover
        node.on('mouseover', function (event, d) { showNodeTooltip(d); })
            .on('mousemove', function (event) { positionTooltip(event); })
            .on('mouseout', function () { tooltip.style('display', 'none'); });

        // Edge hover -- also boost label opacity
        link.on('mouseover', function (event, d) {
                showEdgeTooltip(d);
                d3.select(this).attr('stroke-opacity', 1);
                // Boost matching edge label
                edgeLabels.filter(function (el) { return el === d; }).attr('fill-opacity', 0.7);
            })
            .on('mousemove', function (event) { positionTooltip(event); })
            .on('mouseout', function (event, d) {
                tooltip.style('display', 'none');
                d3.select(this).attr('stroke-opacity', 0.7);
                edgeLabels.filter(function (el) { return el === d; }).attr('fill-opacity', 0.4);
            });

        // --- Click to highlight connections ---
        node.on('click', function (event, d) {
            var connectedIds = new Set();
            connectedIds.add(d.id);
            linkArray.forEach(function (l) {
                var sid = typeof l.source === 'object' ? l.source.id : l.source;
                var tid = typeof l.target === 'object' ? l.target.id : l.target;
                if (sid === d.id) connectedIds.add(tid);
                if (tid === d.id) connectedIds.add(sid);
            });

            node.attr('opacity', function (n) { return connectedIds.has(n.id) ? 1 : 0.15; });
            labels.attr('opacity', function (n) { return connectedIds.has(n.id) ? 1 : 0.15; });
            link.attr('stroke-opacity', function (l) {
                var sid = typeof l.source === 'object' ? l.source.id : l.source;
                var tid = typeof l.target === 'object' ? l.target.id : l.target;
                return (sid === d.id || tid === d.id) ? 0.8 : 0.05;
            });
        });

        // Click background to reset
        svg.on('click', function (event) {
            if (event.target.tagName === 'svg' || event.target.tagName === 'rect') {
                node.attr('opacity', 1);
                labels.attr('opacity', 1);
                link.attr('stroke-opacity', 0.7);
            }
        });

        // --- Edge amount labels (conditional, offset perpendicular to edge) ---
        var edgeLabels = g.append('g')
            .attr('class', 'flow-edge-labels')
            .selectAll('text')
            .data(linkArray.filter(function (d) { return d.amount > 0; }))
            .join('text')
            .text(function (d) { return d.amount.toFixed(4) + ' ' + d.token; })
            .attr('font-size', '7px')
            .attr('fill', '#555')
            .attr('fill-opacity', 0.4)
            .attr('font-family', 'monospace')
            .attr('text-anchor', 'middle');

        // --- Legend ---
        var legendTypes = [
            { label: 'Target', color: '#00ff88' },
            { label: 'CEX', color: '#00aaff' },
            { label: 'DEX', color: '#aa00ff' },
            { label: 'Bridge', color: '#ffaa00' },
            { label: 'Mixer', color: '#ff2222' },
            { label: 'External', color: '#444444' }
        ];
        var legend = svg.append('g').attr('class', 'flow-legend');
        legendTypes.forEach(function (item, i) {
            var y = 20 + i * 18;
            legend.append('circle')
                .attr('cx', 15)
                .attr('cy', y)
                .attr('r', 5)
                .attr('fill', item.color);
            legend.append('text')
                .attr('x', 25)
                .attr('y', y + 4)
                .attr('fill', '#888')
                .attr('font-size', '10px')
                .attr('font-family', 'monospace')
                .text(item.label);
        });

        // --- Helper: compute curved path between two points ---
        function computePath(d) {
            var sx = d.source.x, sy = d.source.y;
            var tx = d.target.x, ty = d.target.y;
            if (d._pairTotal <= 1) {
                // Straight line
                return 'M' + sx + ',' + sy + 'L' + tx + ',' + ty;
            }
            // Curve offset: distribute edges around center
            var dx = tx - sx, dy = ty - sy;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            // Perpendicular unit vector
            var px = -dy / dist, py = dx / dist;
            // Offset: center the group, spread by 15px each
            var offset = (d._pairIndex - (d._pairTotal - 1) / 2) * 15;
            // Midpoint + perpendicular offset -> control point for quadratic bezier
            var mx = (sx + tx) / 2 + px * offset;
            var my = (sy + ty) / 2 + py * offset;
            return 'M' + sx + ',' + sy + 'Q' + mx + ',' + my + ' ' + tx + ',' + ty;
        }

        // --- Tick ---
        simulation.on('tick', function () {
            link.attr('d', computePath);
            node
                .attr('cx', function (d) { return d.x; })
                .attr('cy', function (d) { return d.y; });
            labels
                .attr('x', function (d) { return d.x; })
                .attr('y', function (d) { return d.y; });
            // Position edge labels at midpoint, offset perpendicular, hide short edges
            edgeLabels.each(function (d) {
                var sx = d.source.x, sy = d.source.y;
                var tx = d.target.x, ty = d.target.y;
                var dx = tx - sx, dy = ty - sy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var el = d3.select(this);
                // Hide label if edge is too short
                if (dist < 100) {
                    el.attr('display', 'none');
                    return;
                }
                el.attr('display', null);
                // Perpendicular offset (8px away from the line)
                var px = -dy / dist, py = dx / dist;
                // If curved, use the curve offset direction too
                var curveOff = 0;
                if (d._pairTotal > 1) {
                    curveOff = (d._pairIndex - (d._pairTotal - 1) / 2) * 15;
                }
                var perpOff = 8 + Math.abs(curveOff) * 0.3;
                var sign = (curveOff >= 0) ? 1 : -1;
                var midX = (sx + tx) / 2 + px * (curveOff * 0.5 + perpOff * sign);
                var midY = (sy + ty) / 2 + py * (curveOff * 0.5 + perpOff * sign);
                el.attr('x', midX).attr('y', midY);
            });
        });

        // --- Drag handlers ---
        function dragStart(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
        }
        function dragging(event, d) {
            d.fx = event.x; d.fy = event.y;
        }
        function dragEnd(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
        }
    }
};
