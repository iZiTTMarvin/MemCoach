import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, Activity, User as UserIcon, Target, Crosshair, Radar } from "lucide-react";
import { getProfile } from "../api/interview";

function CollapsibleList({ items, limit, renderItem }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? items : items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <div className="flex flex-col gap-2">
      {show.map((item, i) => renderItem(item, i))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="bg-transparent border-none text-primary hover:text-primary-hover text-xs font-mono cursor-pointer py-2 text-left uppercase tracking-wider transition-colors flex items-center gap-1 mt-2"
        >
          {expanded ? <><ChevronDown size={14}/> 折叠数据</> : <><ChevronRight size={14}/> 展开日志 (+{items.length - limit})</>}
        </button>
      )}
    </div>
  );
}


function ScoreChart({ history }) {
  if (!history || history.length < 2) return null;

  const W = 700, H = 200;
  const PAD = { top: 20, right: 20, bottom: 32, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const points = history.map((h, i) => ({
    x: PAD.left + (i / (history.length - 1)) * innerW,
    y: PAD.top + innerH - (h.avg_score / 10) * innerH,
    score: h.avg_score,
    date: h.date,
    topic: h.topic || "简历节点",
    mode: h.mode,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + innerH} L${points[0].x},${PAD.top + innerH} Z`;

  const yLabels = [0, 5, 10];
  const xIndices = history.length <= 5
    ? history.map((_, i) => i)
    : [0, Math.floor(history.length / 2), history.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-mono">
      {/* Grid lines */}
      {yLabels.map((v) => {
        const y = PAD.top + innerH - (v / 10) * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize={10}>{v}</text>
          </g>
        );
      })}
      
      {/* X Labels */}
      {xIndices.map((i) => (
        <text key={i} x={points[i].x} y={H - 6} textAnchor="middle" fill="var(--primary)" fontSize={10} opacity={0.8}>
          {history[i].date?.slice(5)}
        </text>
      ))}

      {/* Area & Line */}
      <path d={areaPath} fill="url(#chartGrad)" opacity={0.3} />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" />
      
      {/* Data Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--bg-card)" stroke={p.mode === "resume" ? "var(--accent)" : "var(--primary)"} strokeWidth={2} />
          {/* Subtle outer glow for points */}
          <circle cx={p.x} cy={p.y} r={8} fill={p.mode === "resume" ? "var(--accent)" : "var(--primary)"} opacity={0.2} />
          <title>{`${p.date} ${p.mode === "resume" ? "简历节点" : p.topic.toUpperCase()}: ${p.score}/10`}</title>
        </g>
      ))}
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center font-mono text-primary">
      <Activity size={32} className="animate-pulse mb-4" />
      <div className="tracking-widest text-base">正在获取用户画像...</div>
    </div>
  );

  const hasData = profile && (
    profile.stats?.total_sessions > 0 ||
    profile.stats?.total_answers > 0 ||
    (profile.weak_points || []).length > 0 ||
    (profile.strong_points || []).length > 0
  );

  if (!hasData) {
    return (
      <div className="flex-1 px-4 py-12 md:px-10 md:py-20 w-full flex flex-col items-center justify-center font-mono text-center">
        <Radar size={64} className="text-dim mb-6 opacity-30" />
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-text mb-4">画像节点为空</h1>
        <p className="text-base text-dim max-w-md leading-relaxed mb-8">
          无战斗数据可用。启动面试序列以开始编译你的自适应能力矩阵。
        </p>
        <button 
          className="px-8 py-3 bg-primary/20 border border-primary text-primary text-sm font-bold uppercase tracking-wider hover:bg-primary hover:text-bg transition-colors relative group"
          onClick={() => navigate("/")}
        >
          <span className="absolute inset-0 bg-primary/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          启动首次演练
        </button>
      </div>
    );
  }

  const stats = profile.stats || {};
  const weakActive = (profile.weak_points || []).filter((w) => !w.improved);
  const weakImproved = (profile.weak_points || []).filter((w) => w.improved);

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-primary/20 pb-6 mb-10 gap-4">
          <div>
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/30 text-primary text-xs tracking-widest mb-3 uppercase">
              <UserIcon size={12} /> 用户遥测数据
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim">
              战斗画像
            </h1>
          </div>
          <div className="text-right flex flex-col md:items-end">
            <div className="text-xs text-dim mb-1 tracking-widest">上次同步时间</div>
            <div className="text-base text-primary">{profile.updated_at?.slice(0, 16) || "N/A"}</div>
            <div className="text-xs text-dim mt-2 tracking-widest">已处理节点</div>
            <div className="text-base text-accent">{stats.total_answers || 0} 个</div>
          </div>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          
          {/* Global Metrics */}
          <div className="lg:col-span-4 bg-bg-subtle/80 backdrop-blur-sm border border-border/50 p-6 relative group hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
              <Activity size={16}/> 全局指标
            </h2>
            <div className="space-y-6">
              <div>
                <div className="text-xs text-dim mb-1 tracking-widest">总演练次数</div>
                <div className="text-5xl font-display font-bold text-text">{stats.total_sessions}</div>
              </div>
              <div className="h-[1px] w-full bg-gradient-to-r from-border to-transparent" />
              <div>
                <div className="text-xs text-dim mb-1 tracking-widest">综合评级</div>
                <div className="text-5xl font-display font-bold text-accent">{stats.avg_score || "-"}</div>
              </div>
            </div>
          </div>

          {/* Mode Breakdown */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-bg-subtle/50 border border-border/50 p-6 flex flex-col">
              <h3 className="text-xs text-dim font-bold tracking-widest uppercase mb-6 border-l-2 border-primary pl-3">简历节点统计</h3>
              <div className="flex items-center gap-8 mt-auto">
                <div>
                  <div className="text-xs text-dim mb-1 tracking-widest">周期数</div>
                  <div className="text-3xl font-bold text-text">{stats.resume_sessions || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-dim mb-1 tracking-widest">平均分</div>
                  <div className="text-3xl font-bold text-primary">{stats.resume_avg_score ?? "-"}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-bg-subtle/50 border border-border/50 p-6 flex flex-col">
              <h3 className="text-xs text-dim font-bold tracking-widest uppercase mb-6 border-l-2 border-accent pl-3">专项节点统计</h3>
              <div className="flex items-center gap-8 mt-auto">
                <div>
                  <div className="text-xs text-dim mb-1 tracking-widest">周期数</div>
                  <div className="text-3xl font-bold text-text">{stats.drill_sessions || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-dim mb-1 tracking-widest">平均分</div>
                  <div className="text-3xl font-bold text-accent">{stats.drill_avg_score ?? "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Growth Trend */}
        {(stats.score_history || []).length >= 2 && (
          <div className="mb-10">
            <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
               <Activity size={16}/> 战力轨迹
            </h2>
            <div className="bg-bg-subtle/50 border border-border/50 p-6 relative overflow-hidden group">
              <div className="absolute left-0 top-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-colors" />
              <ScoreChart history={stats.score_history} />
            </div>
          </div>
        )}

        {/* Topic Mastery */}
        {Object.keys(profile.topic_mastery || {}).length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
               <Crosshair size={16}/> 领域掌握度映射
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(profile.topic_mastery).map(([topic, data]) => (
                <div
                  key={topic}
                  className="p-5 bg-bg-subtle border border-border/50 cursor-pointer transition-all hover:border-primary/60 group relative overflow-hidden"
                  onClick={() => navigate(`/profile/topic/${topic}`)}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-10 transition-opacity">
                    <Target size={40} />
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-base font-bold tracking-wider uppercase text-text">{topic}</span>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 tracking-widest">
                      {data.score ?? (data.level ? data.level * 20 : 0)}/100
                    </span>
                  </div>
                  <div className="h-1 bg-card border border-border/50 mb-3 overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${data.score ?? (data.level ? data.level * 20 : 0)}%` }}
                    />
                  </div>
                  {data.notes && <div className="text-sm text-dim leading-relaxed font-sans mt-2">{data.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak & Strong side by side */}
        {(weakActive.length > 0 || (profile.strong_points || []).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Weak Points */}
            {weakActive.length > 0 && (
              <div className="bg-bg-subtle border border-border/50 p-6 relative">
                 <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
                 <div className="flex items-center justify-between mb-5">
                   <h2 className="text-sm text-red-400 font-bold tracking-widest uppercase">关键漏洞</h2>
                   <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs">已检测 {weakActive.length} 处</span>
                 </div>
                <CollapsibleList items={weakActive} limit={4} renderItem={(w, i) => (
                  <div key={i} className="px-4 py-3 bg-card/50 border border-border/30 text-sm text-dim hover:text-text hover:border-red-400/30 transition-colors flex flex-col gap-2">
                    <div className="leading-relaxed font-sans">{w.point}</div>
                    <div className="flex items-center gap-3 text-xs tracking-widest uppercase text-red-400/70">
                      {w.topic && <span>[ 节点: {w.topic} ]</span>}
                      <span>出现频次: {w.times_seen}</span>
                    </div>
                  </div>
                )} />
              </div>
            )}
            
            {/* Strong Points */}
            {(profile.strong_points || []).length > 0 && (
              <div className="bg-bg-subtle border border-border/50 p-6 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/50" />
                <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-5">验证优势</h2>
                <CollapsibleList items={profile.strong_points} limit={4} renderItem={(s, i) => (
                  <div key={i} className="px-4 py-3 bg-card/50 border border-border/30 text-sm text-dim hover:text-text hover:border-primary/30 transition-colors flex flex-col gap-2">
                    <div className="leading-relaxed font-sans">{s.point}</div>
                    {s.topic && <div className="text-xs tracking-widest uppercase text-primary/70">[ 节点: {s.topic} ]</div>}
                  </div>
                )} />
              </div>
            )}
          </div>
        )}

        {/* Resolved Vulnerabilities */}
        {weakImproved.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm text-dim font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
               已修复漏洞 <span className="text-primary">[{weakImproved.length}]</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {weakImproved.map((w, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-card/30 border border-border/30 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-sm text-dim font-sans line-through">{w.point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cognitive Patterns */}
        {((profile.thinking_patterns?.strengths || []).length > 0 ||
          (profile.thinking_patterns?.gaps || []).length > 0) && (
          <div className="mb-10">
            <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-4">认知模式</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(profile.thinking_patterns.strengths || []).length > 0 && (
                <div className="p-6 border border-primary/20 bg-primary/5">
                  <h3 className="text-xs text-primary mb-4 tracking-widest uppercase">优势启发式</h3>
                  <CollapsibleList items={profile.thinking_patterns.strengths} limit={3} renderItem={(s, i) => (
                    <div key={i} className="text-sm text-dim mb-2 font-sans pl-3 border-l border-primary/40 leading-relaxed">{s}</div>
                  )} />
                </div>
              )}
              {(profile.thinking_patterns.gaps || []).length > 0 && (
                <div className="p-6 border border-red-500/20 bg-red-500/5">
                  <h3 className="text-xs text-red-400 mb-4 tracking-widest uppercase">认知差距</h3>
                  <CollapsibleList items={profile.thinking_patterns.gaps} limit={3} renderItem={(g, i) => (
                    <div key={i} className="text-sm text-dim mb-2 font-sans pl-3 border-l border-red-500/40 leading-relaxed">{g}</div>
                  )} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Communication Protocol */}
        {profile.communication?.style && (
          <div className="mb-10">
            <h2 className="text-sm text-primary font-bold tracking-widest uppercase mb-4">通信协议分析</h2>
            <div className="p-6 md:p-8 bg-bg-subtle border border-border/50 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
              
              <div className="text-base font-bold text-text mb-6 uppercase tracking-wider font-sans">
                &gt; {profile.communication.style}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                {(profile.communication.habits || []).length > 0 && (
                  <div>
                    <h3 className="text-xs text-dim font-mono tracking-widest uppercase mb-3">观察到的模式</h3>
                    <ul className="space-y-2">
                      {profile.communication.habits.map((h, i) => (
                        <li key={i} className="text-sm text-dim flex items-start gap-2">
                          <span className="text-primary/50 mt-0.5">-</span>
                          <span className="leading-relaxed">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {(profile.communication.suggestions || []).length > 0 && (
                  <div>
                    <h3 className="text-xs text-accent font-mono tracking-widest uppercase mb-3">优化目标</h3>
                    <ul className="space-y-2">
                      {profile.communication.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-text flex items-start gap-2">
                           <span className="text-accent mt-0.5">&gt;</span>
                           <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
