'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode } from '@/lib/api';

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  topic: string;
  summary: string;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  relationship: string;
}

interface Props {
  data: GraphData | null;
  loading: boolean;
  onNodeClick?: (nodeLabel: string) => void;
}

const TOPIC_COLORS = ['#3ecf8e', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function KnowledgeGraph({ data, loading, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: SimNode } | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;

    const topics = [...new Set(data.nodes.map((n) => n.topic))];
    const colorScale = d3.scaleOrdinal<string>().domain(topics).range(TOPIC_COLORS);

    // Compute degree for node sizing
    const degree = new Map<string, number>(data.nodes.map((n) => [n.id, 0]));
    data.edges.forEach((e) => {
      degree.set(String(e.source), (degree.get(String(e.source)) ?? 0) + 1);
      degree.set(String(e.target), (degree.get(String(e.target)) ?? 0) + 1);
    });
    const maxDeg = Math.max(...degree.values(), 1);
    const nodeR = (id: string) => 7 + ((degree.get(id) ?? 0) / maxDeg) * 14;

    // Clone data for simulation
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = data.edges.map((e) => ({ ...e }));

    // Zoom + pan container
    const container = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => container.attr('transform', event.transform)),
    );

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimEdge>(edges).id((d) => d.id).distance(90),
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeR(d.id) + 5));

    // Edges
    const link = container
      .append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#2a2d3e')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7);

    // Drag
    const drag = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Nodes
    const node = container
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => nodeR(d.id))
      .attr('fill', (d) => colorScale(d.topic))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) => colorScale(d.topic))
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .call(drag as unknown as (sel: d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown>) => void)
      .on('click', (_event, d) => {
        onNodeClick?.(d.label);
      })
      .on('mouseenter', (event, d) => {
        const rect = svgEl.getBoundingClientRect();
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d });
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('stroke-width', 3)
          .attr('fill-opacity', 1);
      })
      .on('mouseleave', (event) => {
        setTooltip(null);
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('stroke-width', 2)
          .attr('fill-opacity', 0.85);
      });

    // Labels
    const label = container
      .append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', '9px')
      .attr('fill', '#e5e7eb')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeR(d.id) + 13)
      .attr('pointer-events', 'none');

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);
      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-pulse space-y-3 w-48">
          {[80, 64, 72, 56].map((w, i) => (
            <div key={i} className="h-3 bg-[#2a2d3e] rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="text-[#9ca3af] text-sm">Generating knowledge graph...</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#9ca3af] text-sm text-center max-w-[220px] leading-relaxed">
          Click &quot;Generate Graph&quot; to visualize concepts from this document.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'transparent' }} />
      {tooltip && (
        <div
          className="absolute z-10 bg-[#1c1e2e] border border-[#2a2d3e] rounded-lg p-3 max-w-[220px] shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 14, top: Math.max(0, tooltip.y - 48) }}
        >
          <p className="text-white text-xs font-semibold">{tooltip.node.label}</p>
          <p className="text-[#3ecf8e] text-[10px] mt-0.5">{tooltip.node.topic}</p>
          <p className="text-[#9ca3af] text-[10px] mt-1 leading-relaxed">{tooltip.node.summary}</p>
          <p className="text-[#6366f1] text-[9px] mt-1.5 italic">Click to ask about this</p>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        {[...new Set(data.nodes.map((n) => n.topic))].slice(0, 6).map((topic, i) => (
          <div key={topic} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: ['#3ecf8e', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][i % 6] }}
            />
            <span className="text-[9px] text-[#9ca3af]">{topic}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
