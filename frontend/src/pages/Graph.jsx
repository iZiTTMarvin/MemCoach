import { useState, useEffect, useRef, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getTopics, getGraphData } from "../api/interview";
import { getTopicIcon } from "../utils/topicIcons";

const SIMILARITY_THRESHOLD = 0.65;

function scoreToColor(score) {
  if (score >= 8) return "#22C55E";
  if (score >= 6) return "#FBBF24";
  if (score >= 4) return "#FB923C";
  return "#EF4444";
}

export default function Graph() {
  const [topics, setTopics] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    getTopics().then(setTopics).catch(() => {});
  }, []);

  // Resize observer for responsive canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(400, Math.min(width * 0.65, 600)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSelectTopic = async (key) => {
    setSelectedTopic(key);
    setGraphData(null);
    setLoading(true);
    try {
      const data = await getGraphData(key);
      setGraphData(data);
      // Zoom to fit after data loads
      setTimeout(() => fgRef.current?.zoomToFit(400, 40), 300);
    } catch {
      setGraphData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  };

  const paintNode = useCallback((node, ctx) => {
    const r = 5 + (node.difficulty || 3) * 1.2;
    const color = scoreToColor(node.score);
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const textColor = isLight ? "#18181B" : "#FAFAF9";

    // Glow for hovered node
    if (hoveredNode === node) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;

    if (hoveredNode === node) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Label
    const label = node.focus_area || node.question.slice(0, 20);
    ctx.font = `${hoveredNode === node ? 12 : 10}px DM Sans, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.globalAlpha = hoveredNode === node ? 1 : 0.7;
    ctx.fillText(label, node.x, node.y - r - 5);
    ctx.globalAlpha = 1;
  }, [hoveredNode]);

  const paintLink = useCallback((link, ctx) => {
    const alpha = Math.max(0.08, (link.similarity - SIMILARITY_THRESHOLD) * 3);
    ctx.strokeStyle = `rgba(161, 161, 170, ${alpha})`;
    ctx.lineWidth = 0.5 + link.similarity * 1.5;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  const topicEntries = Object.entries(topics);

  return (
    <div className="flex-1 px-4 py-8 md:px-6 md:py-10 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl md:text-[28px] font-display font-bold mb-6">题目图谱</h1>

      {/* Topic selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {topicEntries.map(([key, info]) => (
          <button
            key={key}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${
              selectedTopic === key
                ? "bg-accent/15 border-accent text-accent-light"
                : "bg-card border-border text-dim hover:text-text hover:border-accent/50"
            }`}
            onClick={() => handleSelectTopic(key)}
          >
            <span className="inline-flex align-middle mr-1">{getTopicIcon(info.icon, 14)}</span>{info.name}
          </button>
        ))}
      </div>

      {/* Graph area */}
      <div
        ref={containerRef}
        className="bg-card border border-border rounded-box overflow-hidden relative"
        style={{ minHeight: 400 }}
      >
        {!selectedTopic && (
          <div className="flex items-center justify-center h-[400px] text-dim text-sm">
            选择一个领域查看题目关联图谱
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-[400px] text-dim text-sm">
            正在构建图谱...
          </div>
        )}

        {selectedTopic && !loading && graphData && graphData.nodes.length === 0 && (
          <div className="flex items-center justify-center h-[400px] text-dim text-sm">
            该领域暂无已评分的训练记录
          </div>
        )}

        {selectedTopic && !loading && graphData && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              const r = 5 + (node.difficulty || 3) * 1.2;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkCanvasObject={paintLink}
            onNodeHover={setHoveredNode}
            cooldownTicks={80}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.3}
          />
        )}

        {/* Tooltip */}
        {hoveredNode && (
          <div className="absolute top-3 right-3 bg-hover border border-border rounded-lg px-4 py-3 max-w-[280px] text-sm pointer-events-none animate-fade-in z-10">
            <div className="font-medium text-text leading-snug mb-2">{hoveredNode.question}</div>
            <div className="flex items-center gap-3 text-[13px] text-dim">
              <span style={{ color: scoreToColor(hoveredNode.score) }}>
                {hoveredNode.score}/10
              </span>
              {hoveredNode.focus_area && <span>{hoveredNode.focus_area}</span>}
              {hoveredNode.date && <span>{hoveredNode.date}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {selectedTopic && graphData && graphData.nodes.length > 0 && (
        <div className="flex items-center gap-5 mt-4 text-[13px] text-dim">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green inline-block" />
            <span>8+</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-light inline-block" />
            <span>6-8</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange inline-block" />
            <span>4-6</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red inline-block" />
            <span>&lt;4</span>
          </div>
          <span className="ml-auto">共 {graphData.nodes.length} 题</span>
        </div>
      )}
    </div>
  );
}
