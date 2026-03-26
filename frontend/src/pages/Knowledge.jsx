import { useState, useEffect, useCallback } from "react";
import { Menu, X, Sparkles, ChevronRight, ChevronDown, Database, Terminal, FileCode, Search, Activity } from "lucide-react";
import { getTopicIcon, ICON_OPTIONS } from "../utils/topicIcons";
import {
  getTopics,
  getCoreKnowledge,
  updateCoreKnowledge,
  createCoreKnowledge,
  deleteCoreKnowledge,
  getHighFreq,
  updateHighFreq,
  createTopic,
  deleteTopic,
  generateKnowledge,
} from "../api/interview";

export default function Knowledge() {
  const [topics, setTopics] = useState({});
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("core");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [coreFiles, setCoreFiles] = useState([]);
  const [expandedFile, setExpandedFile] = useState(null);
  const [editContent, setEditContent] = useState({});
  const [coreSaving, setCoreSaving] = useState(null);

  const [highFreq, setHighFreq] = useState("");
  const [highFreqDraft, setHighFreqDraft] = useState("");
  const [hfSaving, setHfSaving] = useState(false);

  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);

  const [generating, setGenerating] = useState(false);

  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicKey, setNewTopicKey] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicIcon, setNewTopicIcon] = useState("FileText");

  const refreshTopics = useCallback(async () => {
    const t = await getTopics();
    setTopics(t);
    return t;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshTopics().then((t) => {
      const keys = Object.keys(t);
      if (keys.length > 0) setSelected(keys[0]);
    });
  }, [refreshTopics]);

  const loadCore = useCallback(async (topic) => {
    try {
      const files = await getCoreKnowledge(topic);
      setCoreFiles(files);
      setExpandedFile(null);
      const buf = {};
      files.forEach((f) => { buf[f.filename] = f.content; });
      setEditContent(buf);
    } catch { setCoreFiles([]); }
  }, []);

  const loadHighFreq = useCallback(async (topic) => {
    try {
      const data = await getHighFreq(topic);
      setHighFreq(data.content || "");
      setHighFreqDraft(data.content || "");
    } catch { setHighFreq(""); setHighFreqDraft(""); }
  }, []);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCore(selected);
    loadHighFreq(selected);
  }, [selected, loadCore, loadHighFreq]);

  const handleSaveCore = async (filename) => {
    setCoreSaving(filename);
    try {
      await updateCoreKnowledge(selected, filename, editContent[filename] || "");
      setCoreFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: editContent[filename] } : f));
    } catch (e) { alert("保存失败: " + e.message); }
    setTimeout(() => setCoreSaving(null), 1500);
  };

  const handleSaveHighFreq = async () => {
    setHfSaving(true);
    try {
      await updateHighFreq(selected, highFreqDraft);
      setHighFreq(highFreqDraft);
    } catch (e) { alert("保存失败: " + e.message); }
    setTimeout(() => setHfSaving(false), 1500);
  };

  const handleCreateFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    const fname = name.endsWith(".md") ? name : name + ".md";
    try {
      await createCoreKnowledge(selected, fname, "");
      setNewFileName("");
      setShowNewFile(false);
      loadCore(selected);
    } catch (e) { alert("创建失败: " + e.message); }
  };

  const handleDeleteFile = async (filename) => {
    if (!confirm(`确定删除「${filename}」？此操作不可撤销。`)) return;
    try {
      await deleteCoreKnowledge(selected, filename);
      setCoreFiles((prev) => prev.filter((f) => f.filename !== filename));
      if (expandedFile === filename) setExpandedFile(null);
    } catch (e) { alert("删除失败: " + e.message); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateKnowledge(selected);
      await loadCore(selected);
      setExpandedFile("README.md");
    } catch (e) { alert("生成失败: " + e.message); }
    setGenerating(false);
  };

  const coreIsEmpty = coreFiles.length === 0 ||
    (coreFiles.length === 1 && coreFiles[0].filename === "README.md" && (coreFiles[0].content?.length || 0) <= 20);

  const handleAddTopic = async () => {
    const key = newTopicKey.trim();
    const name = newTopicName.trim();
    if (!key || !name) return;
    try {
      await createTopic(key, name, newTopicIcon);
      setNewTopicKey(""); setNewTopicName(""); setNewTopicIcon("FileText");
      setShowAddTopic(false);
      await refreshTopics();
      setSelected(key);
    } catch (e) { alert("添加失败: " + e.message); }
  };

  const handleDeleteTopic = async (key) => {
    if (!confirm(`确定删除「${topics[key]?.name || key}」？`)) return;
    try {
      await deleteTopic(key);
      const t = await refreshTopics();
      const keys = Object.keys(t);
      if (selected === key) setSelected(keys.length > 0 ? keys[0] : null);
    } catch (e) { alert("删除失败: " + e.message); }
  };

  const topicKeys = Object.keys(topics);

  const selectTopic = (key) => {
    setSelected(key);
    setSidebarOpen(false);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full font-mono text-text bg-bg selection:bg-primary/30 relative">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810a_1px,transparent_1px),linear-gradient(to_bottom,#10b9810a_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

      {/* Mobile sidebar toggle */}
      <button
        className="fixed bottom-6 right-6 z-40 md:hidden w-12 h-12 bg-primary/20 border border-primary text-primary flex items-center justify-center backdrop-blur-md"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-[240px] border-r border-primary/20 bg-bg-subtle/90 backdrop-blur-xl flex flex-col transition-transform duration-200
        md:static md:translate-x-0 md:shrink-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex justify-between items-center p-4 border-b border-primary/10">
          <div className="flex items-center gap-2 text-sm font-bold text-primary tracking-widest uppercase">
            <Database size={16} /> 领域数据库
          </div>
          <button
            className="w-6 h-6 border border-primary/30 text-primary flex items-center justify-center transition-all hover:bg-primary/20 hover:border-primary"
            title="新增领域"
            onClick={() => setShowAddTopic(true)}
          >+</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {topicKeys.map((key) => (
            <div key={key} className="relative mb-1 group">
              <button
                className={`w-full px-4 py-3 text-sm text-left cursor-pointer flex items-center gap-3 transition-all border border-transparent
                  ${selected === key ? "bg-primary/10 text-primary border-primary/30" : "bg-transparent text-dim hover:bg-card hover:border-primary/10"}`}
                onClick={() => selectTopic(key)}
              >
                <span className={`${selected === key ? "text-primary" : "text-dim"}`}>{getTopicIcon(topics[key]?.icon, 16)}</span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap uppercase tracking-wider">{topics[key]?.name || key}</span>
                {selected === key && <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-1 py-1"
                title="删除领域"
                onClick={() => handleDeleteTopic(key)}
              ><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Add topic modal */}
      {showAddTopic && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddTopic(false)}>
          <div className="bg-bg-subtle border border-primary/30 p-6 w-[400px] max-w-full relative shadow-[0_0_40px_rgba(16,185,129,0.1)]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />
            
            <div className="flex items-center gap-2 text-primary font-bold text-base tracking-widest mb-6 uppercase border-b border-primary/20 pb-3">
              <Terminal size={18} /> 分配新领域
            </div>
            
            <div className="mb-4">
              <label className="text-xs text-dim mb-1.5 block uppercase tracking-wider">系统标识 (英文)</label>
              <input className="w-full px-4 py-2.5 border border-border bg-bg text-text text-sm focus:border-primary outline-none transition-colors" placeholder="如: docker" value={newTopicKey} onChange={(e) => setNewTopicKey(e.target.value)} autoFocus />
            </div>
            <div className="mb-4">
              <label className="text-xs text-dim mb-1.5 block uppercase tracking-wider">显示名称</label>
              <input className="w-full px-4 py-2.5 border border-border bg-bg text-text text-sm focus:border-primary outline-none transition-colors" placeholder="如: Docker 容器化" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} />
            </div>
            <div className="mb-6">
              <label className="text-xs text-dim mb-2 block uppercase tracking-wider">领域图标</label>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {ICON_OPTIONS.map(({ name, Icon }) => {
                  const DisplayIcon = Icon;
                  return (
                  <button
                    key={name}
                    type="button"
                    className={`w-10 h-10 flex items-center justify-center transition-all border ${
                      newTopicIcon === name ? "bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-card text-dim border-border/50 hover:text-text hover:border-primary/50"
                    }`}
                    onClick={() => setNewTopicIcon(name)}
                    title={name}
                  >
                    <DisplayIcon size={18} />
                  </button>
                )})}
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-8 border-t border-primary/10 pt-4">
              <button className="px-6 py-2.5 border border-border bg-card text-dim text-sm tracking-wider uppercase hover:text-text transition-colors" onClick={() => { setShowAddTopic(false); setNewTopicKey(""); setNewTopicName(""); setNewTopicIcon("FileText"); }}>取消</button>
              <button className="px-6 py-2.5 bg-primary/20 border border-primary text-primary text-sm font-bold tracking-wider uppercase hover:bg-primary hover:text-bg transition-colors disabled:opacity-30 disabled:hover:bg-primary/20 disabled:hover:text-primary" onClick={handleAddTopic} disabled={!newTopicKey.trim() || !newTopicName.trim()}>执行添加</button>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Top Header & Tabs */}
        <div className="bg-bg-subtle/80 backdrop-blur-md border-b border-primary/20 pt-4 px-6 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Activity size={20} />
              知识矩阵矩阵
            </h1>
            {selected && (
              <div className="text-sm text-dim bg-primary/5 border border-primary/20 px-4 py-1.5 flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                当前活跃: {topics[selected]?.name || selected}
              </div>
            )}
          </div>
          <div className="flex gap-6">
            <button
              className={`px-5 py-3 text-sm uppercase tracking-wider transition-all border-b-2 ${tab === "core" ? "text-primary border-primary bg-primary/5" : "text-dim border-transparent hover:text-text hover:bg-card"}`}
              onClick={() => setTab("core")}
            >核心数据</button>
            <button
              className={`px-5 py-3 text-sm uppercase tracking-wider transition-all border-b-2 ${tab === "high_freq" ? "text-accent border-accent bg-accent/5" : "text-dim border-transparent hover:text-text hover:bg-card"}`}
              onClick={() => setTab("high_freq")}
            >高频节点</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-dim opacity-50">
              <Search size={32} className="mb-4 text-primary" />
              <div className="text-sm tracking-widest uppercase">请选择要访问的领域</div>
            </div>
          ) : tab === "core" ? (
            <div className="max-w-6xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border border-border/50 bg-card/40 p-5">
                <div className="text-sm text-dim font-sans">
                  AI 评估的语义依据。支持 Markdown。修改将改变系统智能逻辑。
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {showNewFile ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <input className="flex-1 sm:w-56 px-4 py-2 border border-primary/30 bg-bg text-primary text-sm focus:border-primary outline-none" placeholder="文件名.md" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateFile()} autoFocus />
                      <button className="px-5 py-2 bg-primary/20 border border-primary text-primary text-sm uppercase hover:bg-primary hover:text-bg transition-colors" onClick={handleCreateFile}>初始化</button>
                      <button className="px-4 py-2 border border-border bg-card text-dim text-sm uppercase hover:text-text transition-colors" onClick={() => { setShowNewFile(false); setNewFileName(""); }}><X size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <button className="px-5 py-2.5 border border-border bg-card hover:border-primary/50 text-text text-sm tracking-wider uppercase transition-colors flex items-center gap-2" onClick={() => setShowNewFile(true)}>
                        <FileCode size={16} className="text-primary" /> 分配新文件
                      </button>
                      {coreIsEmpty && (
                        <button
                          className="px-5 py-2.5 bg-accent/10 border border-accent/40 text-accent text-sm tracking-wider uppercase hover:bg-accent hover:text-bg transition-colors disabled:opacity-50 flex items-center gap-2"
                          onClick={handleGenerate}
                          disabled={generating}
                        >
                          <Sparkles size={16} className={generating ? "animate-spin" : ""} />
                          {generating ? "正在合成..." : "自动生成基线数据"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {coreFiles.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border/50 text-dim text-sm uppercase tracking-widest">
                  数据集为空
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {coreFiles.map((f) => (
                    <div key={f.filename} className="bg-bg-subtle border border-primary/20 overflow-hidden relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div
                        className="flex justify-between items-center px-6 py-4 cursor-pointer text-base font-semibold tracking-wider hover:bg-primary/5 transition-colors border-b border-transparent group-hover:border-primary/10"
                        onClick={() => setExpandedFile(expandedFile === f.filename ? null : f.filename)}
                      >
                        <span className="flex items-center gap-3 text-text">
                          <FileCode size={18} className="text-primary" /> {f.filename}
                        </span>
                        <div className="flex items-center gap-5">
                          <span className="text-xs text-dim font-mono">{f.content?.length || 0} 字节</span>
                          <div className="flex items-center gap-3">
                            <button
                              className="text-dim hover:text-red-400 transition-colors px-2 py-2"
                              title="Delete File"
                              onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.filename); }}
                            ><X size={18} /></button>
                            <span className="text-primary">{expandedFile === f.filename ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</span>
                          </div>
                        </div>
                      </div>
                      
                      {expandedFile === f.filename && (
                        <div className="border-t border-primary/20 bg-bg p-5 relative">
                          <textarea
                            className="w-full min-h-[500px] p-5 bg-bg border border-border text-primary/90 text-sm font-mono leading-relaxed resize-y focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none custom-scrollbar"
                            value={editContent[f.filename] ?? f.content}
                            onChange={(e) => setEditContent((prev) => ({ ...prev, [f.filename]: e.target.value }))}
                            spellCheck={false}
                          />
                          <div className="flex items-center justify-end gap-4 mt-5">
                            {coreSaving === f.filename && <span className="text-sm text-accent uppercase tracking-widest flex items-center gap-1"><Sparkles size={14}/> 数据已保存</span>}
                            <button className="px-8 py-3 bg-primary border border-primary text-bg text-sm font-bold uppercase tracking-wider hover:bg-primary-hover hover:border-primary-hover transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]" onClick={() => handleSaveCore(f.filename)}>编译并保存</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
              <div className="text-sm text-dim mb-6 p-5 border border-accent/20 bg-accent/5 text-accent-light font-sans">
                高优先级抗压测试节点。系统将更加积极地从该列表采样。支持 Markdown。
              </div>
              <div className="flex-1 relative min-h-[600px]">
                <textarea
                  className="absolute inset-0 w-full h-full p-6 bg-bg-subtle border border-border text-accent/90 text-sm font-mono leading-relaxed resize-none focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none custom-scrollbar"
                  value={highFreqDraft}
                  onChange={(e) => setHighFreqDraft(e.target.value)}
                  placeholder={"# 高频考点节点\n\n## 1. 架构背后的原理是...\n\n## 2. 如何解决..."}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-end gap-4 mt-6 shrink-0">
                {hfSaving && <span className="text-sm text-accent uppercase tracking-widest flex items-center gap-1"><Sparkles size={14}/> 数据库已同步</span>}
                {highFreqDraft !== highFreq && (
                  <button className="px-6 py-3 border border-border text-dim text-sm uppercase hover:text-text transition-colors" onClick={() => setHighFreqDraft(highFreq)}>还原更改</button>
                )}
                <button className="px-8 py-3 bg-accent/20 border border-accent text-accent text-sm font-bold uppercase tracking-wider hover:bg-accent hover:text-bg transition-colors disabled:opacity-30 disabled:hover:bg-accent/20 disabled:hover:text-accent" onClick={handleSaveHighFreq} disabled={highFreqDraft === highFreq}>更新节点</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
