import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Check, Minus, Star, Terminal, Activity, ShieldAlert } from "lucide-react";
import ChatBubble from "../components/ChatBubble";
import { sendMessage, endInterview, getSessionDetail, updateDrillProgress } from "../api/interview";
import useVoiceInput from "../hooks/useVoiceInput";

export default function Interview() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 会话元数据（从后端恢复接口获取）
  const [sessionMode, setSessionMode] = useState(null);
  const [sessionTopic, setSessionTopic] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const isDrill = sessionMode === "topic_drill";

  // Chat mode state (resume)
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState("");

  // Drill mode state
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [drillInput, setDrillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Voice input for drill mode
  const drillVoice = useVoiceInput({
    onResult: useCallback((text) => setDrillInput((prev) => prev + text), []),
  });

  // Voice input for chat mode
  const chatVoice = useVoiceInput({
    onResult: useCallback((text) => setInput((prev) => prev + text), []),
  });

  // 从后端恢复会话状态（唯一真相源）
  useEffect(() => {
    let cancelled = false;
    async function initSession() {
      try {
        const data = await getSessionDetail(sessionId);
        if (cancelled) return;

        setSessionMode(data.mode);
        setSessionTopic(data.topic);

        // 已完成或已放弃的会话直接跳转
        if (data.status === "completed") {
          navigate(`/review/${sessionId}`, { replace: true });
          return;
        }
        if (data.status === "abandoned") {
          navigate("/", { replace: true });
          return;
        }

        if (data.mode === "topic_drill") {
          // 恢复 drill 状态
          setQuestions(data.questions || []);
          const pp = data.progress_payload || {};
          setAnswers(pp.answers || {});
          setCurrentIndex(pp.current_index || 0);
        } else {
          // 恢复 resume 状态
          const chatMsgs = data.chat_messages || data.transcript || [];
          setMessages(chatMsgs);
          if (data.is_finished) setFinished(true);
          if (data.phase) setProgress(data.phase);
        }
      } catch {
        alert("无法加载训练会话，请返回首页重试。");
        navigate("/", { replace: true });
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    }
    initSession();
    return () => { cancelled = true; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isDrill) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isDrill) textareaRef.current?.focus();
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drill handlers ──
  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).length;

  const handleDrillSubmit = () => {
    const text = drillInput.trim();
    if (!text || !currentQ) return;
    const newAnswers = { ...answers, [currentQ.id]: text };
    setAnswers(newAnswers);
    setDrillInput("");
    const nextIndex = currentIndex < totalQ - 1 ? currentIndex + 1 : currentIndex;
    if (currentIndex < totalQ - 1) setCurrentIndex(nextIndex);
    else setFinished(true);
    // 持久化进度到后端
    updateDrillProgress(sessionId, newAnswers, currentIndex < totalQ - 1 ? nextIndex : currentIndex).catch(() => {});
  };

  const handleSkip = () => {
    if (!currentQ) return;
    setDrillInput("");
    const nextIndex = currentIndex < totalQ - 1 ? currentIndex + 1 : currentIndex;
    if (currentIndex < totalQ - 1) setCurrentIndex(nextIndex);
    else setFinished(true);
    // 持久化进度到后端
    updateDrillProgress(sessionId, answers, currentIndex < totalQ - 1 ? nextIndex : currentIndex).catch(() => {});
  };

  const handlePrev = () => {
    if (currentIndex <= 0) return;
    setDrillInput(answers[questions[currentIndex - 1]?.id] || "");
    setCurrentIndex((i) => i - 1);
  };

  const handleEndDrill = async () => {
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
      }));
      const data = await endInterview(sessionId, answerList);
      navigate(`/review/${sessionId}`, {
        state: { review: data.review, scores: data.scores, overall: data.overall, questions, answers: answerList, mode: "topic_drill", topic: sessionTopic },
      });
    } catch (err) {
      alert("评估失败: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resume chat handlers ──
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const data = await sendMessage(sessionId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.progress) setProgress(data.progress);
      if (data.is_finished) setFinished(true);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `[系统错误] ${err.message}` }]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleEndResume = async () => {
    setReviewing(true);
    try {
      const data = await endInterview(sessionId);
      navigate(`/review/${sessionId}`, {
        state: {
          review: data.review,
          messages,
          mode: "resume",
          dimension_scores: data.dimension_scores,
          avg_score: data.avg_score,
        },
      });
    } catch (err) {
      alert("复盘生成失败: " + err.message);
    } finally {
      setReviewing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      isDrill ? handleDrillSubmit() : handleSend();
    }
  };

  const modeBadge = isDrill
    ? { text: "专项强化模式", cls: "bg-primary/20 text-primary border-primary" }
    : { text: "全流程模拟模式", cls: "bg-accent/20 text-accent border-accent" };

  // ── 加载中 ──
  if (loadingSession) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center font-mono text-text bg-bg gap-6">
        <Activity size={48} className="text-primary animate-pulse" />
        <span className="text-sm text-dim tracking-widest uppercase">正在恢复训练会话...</span>
      </div>
    );
  }

  // ── Drill card mode ──
  if (isDrill) {
    return (
      <div className="flex-1 min-h-0 flex flex-col font-mono text-text bg-bg selection:bg-primary/30 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#10b98110_0%,transparent_70%)] pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-primary/20 bg-bg-subtle/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <span className={`px-3 py-1 border text-xs font-bold tracking-widest uppercase ${modeBadge.cls}`}>{modeBadge.text}</span>
            </div>
            {sessionTopic && (
               <div className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                  <span className="text-dim">领域 //</span>
                  <span className="text-primary">{sessionTopic}</span>
               </div>
            )}
            <div className="text-xs text-dim tracking-widest uppercase border-l border-primary/30 pl-5">
               解决节点: <span className="text-primary">{answeredCount}</span> / <span className="text-text">{totalQ}</span>
            </div>
          </div>
          <button
            className={`px-6 py-2.5 border text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2
              ${submitting ? "border-dim text-dim cursor-not-allowed" : "border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"}`}
            onClick={handleEndDrill}
            disabled={submitting}
          >
            <ShieldAlert size={12} />
            {submitting ? "正在生成战报..." : finished ? "提取战报" : "中止序列并结算"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 flex flex-col items-center gap-6 relative z-10 custom-scrollbar">
          {submitting ? (
            <div className="w-full max-w-[900px] flex flex-col items-center justify-center gap-8 py-24 text-primary">
              <Activity size={56} className="animate-pulse" />
              <div className="flex flex-col items-center gap-3">
                 <span className="text-base font-bold tracking-widest uppercase">编译全维评估矩阵...</span>
                 <span className="text-xs text-dim font-mono">神经网络正在解析 {totalQ} 个节点的应答</span>
              </div>
            </div>
          ) : finished ? (
            <div className="w-full max-w-[900px]">
              <div className="bg-bg-subtle border border-primary/30 p-10 text-center relative overflow-hidden group mb-8">
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
                
                <div className="text-xl font-bold tracking-widest uppercase text-primary mb-6 flex items-center justify-center gap-3">
                  <Check size={24} /> 序列执行完毕
                </div>
                <div className="text-sm text-dim font-mono tracking-widest uppercase mb-10 flex justify-center gap-5">
                   <span className="border border-border px-4 py-2 bg-card">总节点: {totalQ}</span>
                   <span className="border border-primary/30 text-primary px-4 py-2 bg-primary/5">已攻克: {answeredCount}</span>
                   <span className="border border-red-500/30 text-red-400 px-4 py-2 bg-red-500/5">跳过: {totalQ - answeredCount}</span>
                </div>
                <button 
                  className="px-12 py-4 bg-primary/20 border border-primary text-primary text-sm font-bold tracking-widest uppercase hover:bg-primary hover:text-bg transition-colors" 
                  onClick={handleEndDrill}
                >
                  提取最终战报
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {questions.map((q) => (
                  <div key={q.id} className="flex items-start gap-4 p-5 bg-bg-subtle border border-border/50 text-sm font-sans">
                    <div className="pt-0.5 shrink-0">
                      {answers[q.id]
                        ? <Check size={16} className="text-primary" />
                        : <Minus size={16} className="text-red-400" />}
                    </div>
                    <span className="text-dim leading-relaxed"><span className="text-text font-mono mr-3">Q{q.id}:</span>{q.question}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : currentQ ? (
            <>
              {/* Progress bar */}
              <div className="w-full max-w-[900px] flex flex-col gap-2">
                 <div className="flex justify-between text-xs text-dim tracking-widest uppercase font-mono">
                    <span>处理进度</span>
                    <span>{currentIndex + 1} / {totalQ}</span>
                 </div>
                <div className="flex-1 h-2 bg-card border border-border/50 overflow-hidden relative">
                   <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.1)_2px,transparent_2px)] bg-[size:6px_100%]" />
                  <div className="h-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(currentIndex / totalQ) * 100}%` }} />
                </div>
              </div>

              {/* Question card */}
              <div className="w-full max-w-[900px] bg-bg-subtle border border-primary/30 p-8 md:p-10 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Terminal size={120} />
                 </div>
                 <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary/50 to-transparent" />
                 
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-primary/10 pb-5">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-primary border border-primary/30 bg-primary/10 px-3 py-1 tracking-widest">NODE_{currentQ.id}</span>
                    {currentQ.focus_area && (
                      <span className="text-xs text-dim tracking-widest uppercase bg-card border border-border px-3 py-1">{currentQ.focus_area}</span>
                    )}
                  </div>
                  {currentQ.difficulty && (
                    <div className="flex items-center gap-3">
                       <span className="text-xs text-dim tracking-widest uppercase">威胁等级</span>
                      <span className="flex items-center gap-1.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={14} className={i < currentQ.difficulty ? "text-accent fill-accent" : "text-dim opacity-30"} />
                        ))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-base md:text-lg leading-relaxed font-sans text-text md-content relative z-10">
                   <ReactMarkdown>{currentQ.question}</ReactMarkdown>
                </div>
              </div>

              {/* Input area */}
              <div className="w-full max-w-[900px] flex flex-col gap-5">
                <div className="relative group">
                  <div className="absolute left-4 top-4 text-xs text-primary/50 font-bold tracking-widest uppercase">
                    &gt; 候选人输入...
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="w-full pt-12 px-6 pb-6 border border-primary/40 bg-bg text-primary/90 text-base font-sans leading-relaxed resize-y outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-h-[160px] max-h-[400px] custom-scrollbar transition-colors"
                    value={drillInput}
                    onChange={(e) => setDrillInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={drillVoice.isListening ? "正在记录音频流..." : drillVoice.isTranscribing ? "解析音频特征中..." : "输入你的防御策略... [Enter 提交, Shift+Enter 换行]"}
                    spellCheck={false}
                  />
                  {drillVoice.isSupported && (
                    <button
                      className={`absolute right-5 bottom-5 p-2.5 border transition-all flex items-center gap-2 text-xs tracking-widest uppercase font-bold
                        ${drillVoice.isListening 
                          ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse" 
                          : drillVoice.isTranscribing 
                            ? "bg-accent/20 border-accent text-accent animate-pulse" 
                            : "bg-card border-border/50 text-dim hover:text-primary hover:border-primary/50"}`}
                      onClick={drillVoice.toggle}
                      disabled={drillVoice.isTranscribing}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                      {drillVoice.isListening ? "终止记录" : drillVoice.isTranscribing ? "解析中" : "语音接口"}
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-5">
                  {currentIndex > 0 ? (
                    <button className="text-xs text-dim tracking-widest uppercase hover:text-primary transition-colors flex items-center gap-2" onClick={handlePrev}>
                      &lt;&lt; 回退到上一节点
                    </button>
                  ) : <div />}
                  
                  <div className="flex gap-4 w-full sm:w-auto">
                    <button 
                      className="px-8 py-3 border border-border text-dim text-xs font-bold tracking-widest uppercase hover:text-text hover:bg-hover transition-colors flex-1 sm:flex-none text-center" 
                      onClick={handleSkip}
                    >
                      规避此节点
                    </button>
                    <button
                      className={`px-10 py-3 border text-xs font-bold tracking-widest uppercase transition-colors flex-1 sm:flex-none text-center
                        ${!drillInput.trim() 
                          ? "bg-card border-border/50 text-dim opacity-50 cursor-not-allowed" 
                          : "bg-primary/20 border-primary text-primary hover:bg-primary hover:text-bg"}`}
                      onClick={handleDrillSubmit}
                      disabled={!drillInput.trim()}
                    >
                      {currentIndex < totalQ - 1 ? "提交并推进 &gt;&gt;" : "完成所有验证"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Chat mode (resume interview) ──
  return (
    <div className="flex-1 min-h-0 flex flex-col font-mono text-text bg-bg selection:bg-primary/30 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#10b9810a_0%,transparent_80%)] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-primary/20 bg-bg-subtle/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
             <Activity size={16} className="text-accent animate-pulse" />
            <span className={`px-3 py-1 border text-xs font-bold tracking-widest uppercase ${modeBadge.cls}`}>{modeBadge.text}</span>
          </div>
          {sessionTopic && (
             <div className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                <span className="text-dim">上下文 //</span>
                <span className="text-accent">{sessionTopic}</span>
             </div>
          )}
          {progress && (
            <div className="text-xs text-dim tracking-widest uppercase border-l border-primary/30 pl-5 flex items-center gap-2">
              <span>处理进度</span>
              <span className="text-primary">{progress}</span>
            </div>
          )}
        </div>
        <button
          className={`px-6 py-2.5 border text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2
            ${reviewing ? "border-dim text-dim cursor-not-allowed" : finished ? "border-primary text-primary hover:bg-primary hover:text-bg" : "border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"}`}
          onClick={handleEndResume}
          disabled={reviewing}
        >
          {reviewing ? (
             <>
               <Terminal size={14} className="animate-spin" /> 编译战报中...
             </>
          ) : finished ? (
            <>提取评估报告</>
          ) : (
            <><ShieldAlert size={14}/> 中止连接</>
          )}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 flex flex-col gap-6 w-full max-w-5xl mx-auto relative z-10 custom-scrollbar">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {sending && (
          <div className="flex items-center gap-3 px-6 py-4 bg-bg-subtle border border-primary/20 text-primary text-sm tracking-widest uppercase font-bold self-start w-full max-w-[80%] opacity-80">
            <Activity size={14} className="animate-pulse" />
            <div className="flex gap-1">
              <span>系统正在解析响应</span>
              <span className="animate-[pulse_1s_infinite]">.</span>
              <span className="animate-[pulse_1.2s_infinite]">.</span>
              <span className="animate-[pulse_1.4s_infinite]">.</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-bg border-t border-primary/20 relative z-20 flex justify-center">
        <div className="relative w-full max-w-5xl group">
          <div className="absolute left-5 top-5 text-xs text-primary/50 font-bold tracking-widest uppercase">
             &gt; CANDIDATE_INPUT...
          </div>
          <textarea
            ref={textareaRef}
            className="w-full pt-12 px-5 pb-5 border border-primary/40 bg-bg-subtle text-text text-base font-sans leading-relaxed resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[120px] max-h-[300px] custom-scrollbar transition-colors disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatVoice.isListening ? "音频流接入中..." : chatVoice.isTranscribing ? "解析音频特征..." : finished ? "连接已终止。请查看评估战报。" : "输入数据... [Enter 发送, Shift+Enter 换行]"}
            disabled={finished || sending}
            spellCheck={false}
          />
          {chatVoice.isSupported && !finished && (
            <button
              className={`absolute right-5 bottom-5 p-2.5 border transition-all flex items-center gap-2 text-xs tracking-widest uppercase font-bold
                ${chatVoice.isListening 
                  ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse" 
                  : chatVoice.isTranscribing 
                    ? "bg-accent/20 border-accent text-accent animate-pulse" 
                    : "bg-card border-border/50 text-dim hover:text-primary hover:border-primary/50"}`}
              onClick={chatVoice.toggle}
              disabled={chatVoice.isTranscribing || sending}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              {chatVoice.isListening ? "终止记录" : chatVoice.isTranscribing ? "解析中" : "语音接口"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
