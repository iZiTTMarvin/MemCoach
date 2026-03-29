import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home, User, BookOpen, GitFork, Clock, Mic,
  Sun, Moon, LogOut, Menu, X, Terminal, FolderGit2
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "基地 / HOME", icon: Home },
  { path: "/profile", label: "画像 / PROFILE", icon: User },
  { path: "/knowledge", label: "题库 / KNOWLEDGE", icon: BookOpen },
  { path: "/graph", label: "图谱 / GRAPH", icon: GitFork },
  { path: "/history", label: "记录 / HISTORY", icon: Clock },
  { path: "/recording", label: "复盘 / RECORDING", icon: Mic },
  { path: "/project-analysis", label: "项目 / PROJECT", icon: FolderGit2 },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close on route change
  useEffect(() => {
    const handleClose = () => setOpen(false);
    handleClose();
  }, [location.pathname]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const nav = (
    <aside className="flex flex-col h-full w-[260px] bg-bg-subtle/80 backdrop-blur-xl border-r border-primary/20 shadow-[4px_0_24px_rgba(0,0,0,0.5)] relative z-20 font-mono">
      {/* Decorative scanning line */}
      <div className="absolute top-0 right-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-1/3 bg-gradient-to-b from-transparent via-primary/50 to-transparent animate-[scanline_4s_linear_infinite]" />
      </div>

      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 py-8 cursor-pointer shrink-0 group border-b border-primary/10"
        onClick={() => navigate("/")}
      >
        <div className="w-10 h-10 rounded-none border border-primary/40 bg-card/60 flex items-center justify-center relative overflow-hidden group-hover:border-primary transition-colors">
          <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Terminal size={20} className="text-primary relative z-10" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-widest text-text group-hover:text-primary transition-colors">
            MEMCOACH
          </span>
          <span className="text-[10px] text-primary/60 tracking-widest">系统_已连接</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-2 px-4 overflow-y-auto pt-6 pb-6 scrollbar-hide">
        <div className="text-[10px] text-primary/40 tracking-widest px-2 mb-2 uppercase">核心_功能模块</div>
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const NavIcon = Icon;
          return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-3 w-full px-4 py-3 text-xs transition-all duration-300 text-left relative overflow-hidden group
              ${isActive(path)
                ? "bg-primary/10 text-primary font-bold border border-primary/30"
                : "text-dim hover:text-text hover:bg-hover/50 border border-transparent"
              }`}
          >
            {isActive(path) && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_8px_var(--color-primary)]" />
            )}
            <NavIcon size={16} className={`relative z-10 transition-transform duration-300 ${isActive(path) ? "text-primary" : "group-hover:text-primary"}`} />
            <span className="relative z-10 tracking-wider">{label}</span>
            {isActive(path) && <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
          </button>
        )})}
      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-6 pt-4 border-t border-primary/10 mt-auto shrink-0 space-y-2 bg-gradient-to-t from-bg-subtle/80 to-transparent">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-dim uppercase tracking-wider
                     hover:text-text hover:bg-hover/50 border border-transparent hover:border-primary/30 transition-all group"
        >
          <div className="relative">
            {theme === "dark" ? (
              <Sun size={16} className="group-hover:text-accent transition-colors" />
            ) : (
              <Moon size={16} className="group-hover:text-primary transition-colors" />
            )}
          </div>
          {theme === "dark" ? "浅色模式" : "深空模式"}
        </button>

        {/* User + logout */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-dim uppercase tracking-wider
                       hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/30 transition-all group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="truncate flex-1">{user.name || user.email}</span>
            <span className="text-[10px] text-red-500/50 group-hover:text-red-400">断开连接</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 bg-bg-subtle/90 backdrop-blur-xl border-b border-primary/20 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3" onClick={() => navigate("/")}>
          <div className="w-8 h-8 rounded-none border border-primary/40 bg-card flex items-center justify-center">
            <Terminal size={16} className="text-primary" />
          </div>
          <span className="text-lg font-mono font-bold text-text tracking-widest">MEMCOACH</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-10 h-10 bg-card border border-primary/30 flex items-center justify-center text-text hover:bg-primary/20 hover:text-primary transition-all"
          aria-label="Menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex shrink-0 z-30">
        {nav}
      </div>

      {/* Mobile sidebar — slide overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="animate-fade-in flex h-full">{nav}</div>
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
