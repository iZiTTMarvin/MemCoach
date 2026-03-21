import { getTopicIcon } from "../utils/topicIcons";

export default function TopicCard({ topicKey, name, icon, onClick, selected }) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 rounded-box cursor-pointer transition-all text-left
        border ${selected ? "border-accent bg-hover shadow-[0_0_16px_rgba(245,158,11,0.1)]" : "border-border bg-card"}
        hover:border-accent hover:-translate-y-px hover:shadow-[0_0_16px_rgba(245,158,11,0.08)]`}
      onClick={onClick}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-hover text-dim">
        {getTopicIcon(icon, 22)}
      </div>
      <div>
        <div className="text-[15px] font-medium text-text">{name}</div>
        <div className="text-xs text-dim mt-0.5">{topicKey}</div>
      </div>
    </div>
  );
}
