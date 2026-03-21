import ReactMarkdown from "react-markdown";
import { User, Terminal } from "lucide-react";

export default function ChatBubble({ role, content }) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-fade-in group">
        <div className="flex flex-col items-end gap-2 max-w-[85%] sm:max-w-[70%]">
          <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-bold text-accent">
            <span className="opacity-70">候选人_节点</span>
            <User size={12} />
          </div>
          <div className="px-5 py-4 border border-accent/30 bg-accent/5 text-text text-sm font-sans leading-relaxed whitespace-pre-wrap relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-accent" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-accent" />
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in group">
      <div className="flex flex-col items-start gap-2 max-w-full md:max-w-[90%] mb-4">
        <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-bold text-primary">
          <Terminal size={12} />
          <span className="opacity-70">系统_节点</span>
        </div>
        <div className="px-5 py-5 border border-primary/20 bg-bg-subtle/80 backdrop-blur-sm text-sm text-text leading-relaxed font-sans relative w-full group-hover:border-primary/40 transition-colors">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent" />
          <div className="md-content relative z-10 pl-2">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
