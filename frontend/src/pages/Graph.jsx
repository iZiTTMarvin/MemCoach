import { useState, useEffect, useRef, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { GitFork, Activity } from "lucide-react";
import { getTopics, getGraphData } from "../api/interview";
import { getTopicIcon } from "../utils/topicIcons";

const SIMILARITY_THRESHOLD = 0.65;

// Using hardcoded hex values for canvas rendering matching our Sci-Fi theme
function scoreToColor(score) {
  if (score >= 8) return "#10b981"; // Primary (Emerald)
  if (score >= 6) return "#2dd4bf"; // Teal
  if (score >= 4) return "#d9f99d"; // Accent (Acid Yellow)
  return "#ef4444";                 // Red
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
    const textColor = "#f1f5f9"; // var(--text)

    // Glow for hovered node
    if (hoveredNode === node) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;

    if (hoveredNode === node) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#040d12"; // var(--bg)
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label
    const label = node.focus_area || node.question.slice(0, 20);
    ctx.font = `${hoveredNode === node ? 12 : 10}px 'JetBrains Mono', 'Fira Code', monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.globalAlpha = hoveredNode === node ? 1 : 0.6;
    ctx.fillText(label, node.x, node.y - r - 6);
    ctx.globalAlpha = 1;
  }, [hoveredNode]);

  const paintLink = useCallback((link, ctx) => {
    const alpha = Math.max(0.1, (link.similarity - SIMILARITY_THRESHOLD) * 3);
    ctx.strokeStyle = `rgba(20, 184, 166, ${alpha})`; // Teal links
    ctx.lineWidth = 0.5 + link.similarity * 2;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  const topicEntries = Object.entries(topics);

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30">
      <div className="max-w-5xl mx-auto">
        
        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-primary/20 pb-6 mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary text-[11px] tracking-widest mb-2 uppercase">
              <GitFork size={12} /> 拓扑图谱
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim">
              知识图谱
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-dim mb-1 tracking-widest">网络节点总数</div>
            <div className="text-lg font-bold text-primary">{graphData ? graphData.nodes.length : 0}</div>
          </div>
        </div>

        {/* Topic selector */}
        <div className="flex flex-wrap gap-3 mb-8 bg-bg-subtle/80 backdrop-blur-sm border border-border/50 p-5 relative overflow-hidden group">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent" />
           <div className="text-xs text-dim tracking-widest uppercase mb-2 w-full flex items-center gap-2">
             <Activity size={14} /> 选择领域矩阵:
           </div>
          {topicEntries.map(([key, info]) => (
            <button
              key={key}
              className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all border ${
                selectedTopic === key
                  ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "bg-card border-border/50 text-dim hover:text-text hover:border-primary/50"
              }`}
              onClick={() => handleSelectTopic(key)}
            >
              <span className="inline-flex align-middle mr-2 opacity-80">{getTopicIcon(info.icon, 14)}</span>
              {info.name}
            </button>
          ))}
        </div>

        {/* Graph area */}
        <div
          ref={containerRef}
          className="bg-bg-subtle border border-primary/30 overflow-hidden relative shadow-2xl"
          style={{ minHeight: 400 }}
        >
          {/* Scanning line animation */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(16,185,129,0.05),transparent)] h-[20%] animate-[scanline_4s_linear_infinite] pointer-events-none" />

          {!selectedTopic && (
            <div className="flex flex-col items-center justify-center h-[400px] text-dim opacity-50 uppercase tracking-widest text-sm">
              <GitFork size={32} className="mb-4 text-primary" />
              等待选择领域...
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-[400px] text-primary uppercase tracking-widest text-sm">
              <Activity size={32} className="animate-pulse mb-4" />
              正在构建拓扑图...
            </div>
          )}

          {selectedTopic && !loading && graphData && graphData.nodes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[400px] text-dim opacity-50 uppercase tracking-widest text-sm">
              <Activity size={32} className="mb-4" />
              该领域数据不足以构建图谱
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
            <div className="absolute top-4 right-4 bg-bg-subtle/95 backdrop-blur-md border border-primary text-text px-5 py-4 max-w-[320px] text-sm pointer-events-none z-10 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />
              
              <div className="text-[11px] text-primary tracking-widest uppercase mb-2">节点检查</div>
              <div className="font-bold leading-relaxed mb-3">{hoveredNode.question}</div>
              
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-[9px] text-dim uppercase tracking-wider">评级</span>
                  <span className="font-bold" style={{ color: scoreToColor(hoveredNode.score) }}>
                    {hoveredNode.score}/10
                  </span>
                </div>
                {hoveredNode.focus_area && (
                  <div className="flex flex-col">
                    <span className="text-[9px] text-dim uppercase tracking-wider">方向</span>
                    <span className="text-accent">{hoveredNode.focus_area}</span>
                  </div>
                )}
                {hoveredNode.date && (
                  <div className="flex flex-col">
                    <span className="text-[9px] text-dim uppercase tracking-wider">时间戳</span>
                    <span className="text-text">{hoveredNode.date}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {selectedTopic && graphData && graphData.nodes.length > 0 && (
          <div className="flex items-center gap-6 mt-6 p-4 bg-card/40 border border-border/50 text-[11px] text-dim font-bold tracking-widest uppercase flex-wrap">
            <span className="mr-2 text-primary">图例:</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#10b981] shadow-[0_0_8px_#10b981]" />
              <span>极佳 [8+]</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]" />
              <span>稳定 [6-8]</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#d9f99d] shadow-[0_0_8px_#d9f99d]" />
              <span>一般 [4-6]</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#ef4444] shadow-[0_0_8px_#ef4444]" />
              <span>危险 [&lt;4]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
