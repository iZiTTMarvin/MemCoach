import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Users, User, Loader2, Mic, Activity, Server, Radio } from "lucide-react";
import { transcribeRecording, analyzeRecording } from "../api/interview";

export default function RecordingAnalysis() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [recordingMode, setRecordingMode] = useState("dual");
  const [inputTab, setInputTab] = useState("upload"); // "upload" | "paste"
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");

  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setTranscript("");
    setError(null);
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setError(null);
    try {
      const data = await transcribeRecording(audioFile, recordingMode);
      setTranscript(data.transcript || "");
    } catch (err) {
      setError("转写失败: " + err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeRecording(
        transcript, recordingMode, company || null, position || null
      );
      navigate(`/review/${data.session_id}`, {
        state: {
          ...data,
          mode: "recording",
        },
      });
    } catch (err) {
      setError("分析失败: " + err.message);
      setAnalyzing(false);
    }
  };

  const canAnalyze = transcript.trim() && !analyzing;

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30 flex flex-col items-center">
      <div className="w-full max-w-[800px]">
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-primary/20 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-teal-400/10 border border-teal-400/30 text-teal-400 text-[10px] tracking-widest mb-3 uppercase">
              <Radio size={12} className="animate-pulse" /> 音频遥测
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim">
              录音复盘
            </h1>
            <p className="text-xs text-dim tracking-widest mt-2">上传音频或粘贴转写文本进行 AI 联合分析</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-[10px] text-dim mb-1 tracking-widest">分析服务器</div>
            <div className="text-sm font-bold text-teal-400 flex items-center gap-2 justify-end">
               <Server size={14} /> 在线
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-bg-subtle border border-border/50 p-6 md:p-8 relative group mb-8">
           <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-teal-400/30 opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-teal-400/30 opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Recording mode */}
          <div className="mb-8">
            <div className="text-xs text-teal-400 font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Activity size={14}/> 录音模式
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                className={`flex items-center gap-3 p-4 border transition-all text-left relative overflow-hidden
                  ${recordingMode === "dual"
                    ? "bg-teal-400/10 border-teal-400 text-teal-400"
                    : "bg-card border-border/50 text-dim hover:border-teal-400/50 hover:text-text"}`}
                onClick={() => setRecordingMode("dual")}
              >
                {recordingMode === "dual" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400 shadow-[0_0_8px_var(--color-teal-400)]" />}
                <Users size={20} className={recordingMode === "dual" ? "text-teal-400" : ""} />
                <div>
                  <div className="text-sm font-bold tracking-widest uppercase">双人对话</div>
                  <div className="text-[10px] opacity-70 tracking-wider">面试官 + 候选人</div>
                </div>
              </button>
              
              <button
                className={`flex items-center gap-3 p-4 border transition-all text-left relative overflow-hidden
                  ${recordingMode === "solo"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-card border-border/50 text-dim hover:border-primary/50 hover:text-text"}`}
                onClick={() => setRecordingMode("solo")}
              >
                {recordingMode === "solo" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_8px_var(--color-primary)]" />}
                <User size={20} className={recordingMode === "solo" ? "text-primary" : ""} />
                <div>
                  <div className="text-sm font-bold tracking-widest uppercase">单人录音</div>
                  <div className="text-[10px] opacity-70 tracking-wider">仅限候选人</div>
                </div>
              </button>
            </div>
          </div>

          {/* Optional: company & position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-dim tracking-widest uppercase mb-2 block">目标组织 [可选]</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-card border border-border/50 text-sm text-text placeholder:text-dim/30 focus:outline-none focus:border-teal-400/50 transition-colors"
                placeholder="如: 字节跳动"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-[10px] text-dim tracking-widest uppercase mb-2 block">目标角色 [可选]</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-card border border-border/50 text-sm text-text placeholder:text-dim/30 focus:outline-none focus:border-teal-400/50 transition-colors"
                placeholder="如: 后端开发"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Input tabs */}
        <div className="mb-8">
          <div className="flex gap-2 mb-6">
            <button
              className={`px-6 py-2 text-xs font-bold tracking-widest uppercase border-b-2 transition-all ${inputTab === "upload" ? "text-teal-400 border-teal-400 bg-teal-400/5" : "text-dim border-transparent hover:text-text hover:bg-card"}`}
              onClick={() => setInputTab("upload")}
            >
              上传音频
            </button>
            <button
              className={`px-6 py-2 text-xs font-bold tracking-widest uppercase border-b-2 transition-all ${inputTab === "paste" ? "text-primary border-primary bg-primary/5" : "text-dim border-transparent hover:text-text hover:bg-card"}`}
              onClick={() => setInputTab("paste")}
            >
              纯文本粘贴
            </button>
          </div>

          {inputTab === "upload" && (
            <div className="space-y-4">
              <div
                className={`flex flex-col items-center justify-center py-12 px-6 bg-bg-subtle border border-dashed transition-all cursor-pointer group
                  ${audioFile ? "border-teal-400/50 text-text" : "border-border/60 text-dim hover:border-teal-400/50 hover:bg-teal-400/5"}`}
                onClick={() => fileRef.current?.click()}
              >
                {audioFile ? (
                  <>
                    <FileText size={32} className="text-teal-400 mb-4" />
                    <span className="font-bold tracking-wider text-sm mb-2">{audioFile.name}</span>
                    <span className="text-[10px] text-dim tracking-widest uppercase">
                      {(audioFile.size / 1024 / 1024).toFixed(1)} MB // 点击重新上传
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="mb-4 text-dim group-hover:text-teal-400 transition-colors" />
                    <span className="font-bold tracking-wider text-sm mb-2 uppercase text-text">拖拽或点击选择音频文件</span>
                    <span className="text-[10px] text-dim tracking-widest uppercase">支持格式: MP3, WAV, M4A, WEBM</span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {audioFile && !transcript && (
                <button
                  className={`w-full py-4 text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3
                    ${transcribing
                      ? "bg-teal-400/10 border border-teal-400/30 text-teal-400 cursor-wait"
                      : "bg-teal-400/20 border border-teal-400 text-teal-400 hover:bg-teal-400 hover:text-bg"}`}
                  onClick={handleTranscribe}
                  disabled={transcribing}
                >
                  {transcribing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      音频流转写中...
                    </>
                  ) : (
                    "开始音频转写"
                  )}
                </button>
              )}
            </div>
          )}

          {inputTab === "paste" && !transcript && (
            <textarea
              className="w-full h-64 p-5 bg-bg-subtle border border-border/50 text-sm font-mono text-primary/90 leading-relaxed resize-y placeholder:text-dim/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 custom-scrollbar"
              placeholder={
                recordingMode === "dual"
                  ? "在此粘贴面试转写记录...\n\n格式示例：\n面试官：请介绍一下你的背景。\n我：我是一名软件工程师..."
                  : "在此粘贴你的技术演讲/复盘内容..."
              }
              onBlur={(e) => setTranscript(e.target.value)}
              defaultValue=""
              spellCheck={false}
            />
          )}
        </div>

        {/* Transcript display & edit */}
        {transcript && (
          <div className="mb-8">
             <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-primary font-bold tracking-widest uppercase flex items-center gap-2">
                <FileText size={14}/> 解析结果文本
              </div>
              <span className="text-[10px] text-dim tracking-widest uppercase bg-card px-2 py-0.5 border border-border/50">支持人工修正</span>
            </div>
            <textarea
              className="w-full h-80 p-5 bg-bg border border-primary/30 text-sm font-mono text-primary/90 leading-relaxed resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 custom-scrollbar"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 px-5 py-4 bg-red-500/5 border-l-4 border-red-500 text-sm text-red-400 font-mono flex items-center gap-3">
            <Activity size={16} /> {error}
          </div>
        )}

        {/* Analyze button */}
        {transcript && (
          <button
            className={`w-full py-4 text-base font-black tracking-widest uppercase transition-all relative overflow-hidden group border
              ${canAnalyze
                ? "bg-accent/10 border-accent text-accent hover:bg-accent hover:text-bg shadow-[0_0_20px_rgba(217,249,157,0.1)] hover:shadow-[0_0_40px_rgba(217,249,157,0.4)]"
                : "bg-bg-subtle border-border/50 text-dim cursor-not-allowed"}`}
            disabled={!canAnalyze}
            onClick={handleAnalyze}
          >
             {canAnalyze && !analyzing && (
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-no-repeat bg-[position:-100%_0,0_0] group-hover:transition-[background-position_0s_ease] group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1000ms]" />
             )}
            <span className="relative z-10 flex items-center justify-center gap-3">
              {analyzing ? (
                <>
                   <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  遥测数据分析中...
                </>
              ) : (
                "初始化分析引擎"
              )}
            </span>
            {/* Corners */}
             <div className="absolute top-0 left-0 w-2 h-2 bg-bg" />
             <div className="absolute bottom-0 right-0 w-2 h-2 bg-bg" />
          </button>
        )}

        {/* Back */}
        <div className="mt-8 text-center">
          <button
            className="px-6 py-2 bg-transparent text-dim text-[10px] font-bold tracking-widest uppercase border border-border/50 hover:border-primary/50 hover:text-primary transition-colors"
            onClick={() => navigate("/")}
          >
            中止 // 返回主控台
          </button>
        </div>
      </div>
    </div>
  );
}
