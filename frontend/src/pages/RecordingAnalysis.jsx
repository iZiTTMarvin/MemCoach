import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Users, User, Loader2 } from "lucide-react";
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
    <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-10 md:px-6 md:pt-12">
      <div className="w-full max-w-[700px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-[28px] font-display font-bold mb-2">录音复盘</h1>
          <p className="text-sm text-dim">上传面试录音或粘贴转写文字，AI 自动识别涉及领域并分析复盘</p>
        </div>

        {/* Recording mode */}
        <div className="mb-6">
          <div className="text-[15px] font-semibold mb-3">录音模式</div>
          <div className="flex gap-3">
            <button
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all text-sm font-medium
                ${recordingMode === "dual"
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-border bg-card text-dim hover:border-blue-500/50"}`}
              onClick={() => setRecordingMode("dual")}
            >
              <Users size={18} />
              双人对话
              <span className="text-xs opacity-60 ml-1">面试官+你</span>
            </button>
            <button
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all text-sm font-medium
                ${recordingMode === "solo"
                  ? "border-violet-500 bg-violet-500/10 text-violet-400"
                  : "border-border bg-card text-dim hover:border-violet-500/50"}`}
              onClick={() => setRecordingMode("solo")}
            >
              <User size={18} />
              单人录音
              <span className="text-xs opacity-60 ml-1">只有你</span>
            </button>
          </div>
        </div>

        {/* Optional: company & position */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <label className="text-xs text-dim mb-1 block">公司（可选）</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text placeholder:text-dim/50 focus:outline-none focus:border-accent/50"
              placeholder="例：字节跳动"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-dim mb-1 block">岗位（可选）</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text placeholder:text-dim/50 focus:outline-none focus:border-accent/50"
              placeholder="例：后端开发实习"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
        </div>

        {/* Input tabs */}
        <div className="mb-4">
          <div className="flex gap-1 bg-hover rounded-lg p-1 w-fit mb-4">
            <button
              className={`px-4 py-1.5 rounded-md text-sm transition-all ${inputTab === "upload" ? "bg-card text-text shadow-sm" : "text-dim"}`}
              onClick={() => setInputTab("upload")}
            >
              上传录音
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm transition-all ${inputTab === "paste" ? "bg-card text-text shadow-sm" : "text-dim"}`}
              onClick={() => setInputTab("paste")}
            >
              粘贴文字
            </button>
          </div>

          {inputTab === "upload" && (
            <div className="space-y-3">
              <div
                className={`flex flex-col items-center gap-2 px-5 py-8 bg-card border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm
                  ${audioFile ? "border-accent/40 text-text" : "border-border text-dim hover:border-accent/30"}`}
                onClick={() => fileRef.current?.click()}
              >
                {audioFile ? (
                  <>
                    <FileText size={28} className="text-accent-light" />
                    <span className="font-medium">{audioFile.name}</span>
                    <span className="text-xs text-dim">
                      {(audioFile.size / 1024 / 1024).toFixed(1)} MB — 点击更换
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={28} />
                    <span>点击上传音频文件</span>
                    <span className="text-xs text-dim">支持 mp3, wav, m4a, webm 等格式</span>
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
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all
                    ${transcribing
                      ? "bg-blue-500/20 text-blue-400 cursor-wait"
                      : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"}`}
                  onClick={handleTranscribe}
                  disabled={transcribing}
                >
                  {transcribing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      转写中，请稍候...
                    </span>
                  ) : (
                    "开始转写"
                  )}
                </button>
              )}
            </div>
          )}

          {inputTab === "paste" && !transcript && (
            <textarea
              className="w-full h-48 px-4 py-3 rounded-xl bg-card border border-border text-sm text-text leading-relaxed resize-y placeholder:text-dim/50 focus:outline-none focus:border-accent/50"
              placeholder={
                recordingMode === "dual"
                  ? "粘贴面试对话记录...\n\n格式示例：\n面试官：请介绍一下你自己\n我：我是XXX，目前..."
                  : "粘贴你的技术表达/复盘内容..."
              }
              onBlur={(e) => setTranscript(e.target.value)}
              defaultValue=""
            />
          )}
        </div>

        {/* Transcript display & edit */}
        {transcript && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[15px] font-semibold">转写结果</span>
              <span className="text-xs text-dim">可直接编辑修正</span>
            </div>
            <textarea
              className="w-full h-64 px-4 py-3 rounded-xl bg-card border border-border text-sm text-text leading-relaxed resize-y focus:outline-none focus:border-accent/50"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red/10 border border-red/20 text-sm text-red">
            {error}
          </div>
        )}

        {/* Analyze button */}
        {transcript && (
          <button
            className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all
              ${canAnalyze
                ? "bg-gradient-to-r from-accent to-orange text-white hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]"
                : "bg-hover text-dim cursor-not-allowed"}`}
            disabled={!canAnalyze}
            onClick={handleAnalyze}
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                AI 分析中...
              </span>
            ) : (
              "开始分析"
            )}
          </button>
        )}

        {/* Back */}
        <button
          className="mt-6 px-5 py-2.5 rounded-xl bg-transparent text-dim text-sm border border-border cursor-pointer hover:text-text"
          onClick={() => navigate("/")}
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
