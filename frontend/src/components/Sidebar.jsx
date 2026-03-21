import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home, User, BookOpen, GitFork, Clock, Mic,
  Sun, Moon, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "首页", icon: Home },
  { path: "/profile", label: "我的画像", icon: User },
  { path: "/knowledge", label: "题库", icon: BookOpen },
  { path: "/graph", label: "图谱", icon: GitFork },
  { path: "/history", label: "历史记录", icon: Clock },
  { path: "/recording", label: "录音复盘", icon: Mic },
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
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const nav = (
    <aside className="flex flex-col h-full w-[200px] bg-card border-r border-border">
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-5 cursor-pointer shrink-0"
        onClick={() => navigate("/")}
      >
        <img src="/logo.png" alt="TechSpar" className="w-7 h-7 rounded-lg object-contain" />
        <span className="text-base font-display font-bold text-text">TechSpar</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] transition-all text-left
              ${isActive(path)
                ? "bg-accent/12 text-accent font-medium"
                : "text-dim hover:text-text hover:bg-hover"
              }`}
          >
            <Icon size={16} className={isActive(path) ? "text-accent" : ""} />
            {label}
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 pt-2 border-t border-border mt-auto shrink-0 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-dim
                     hover:text-text hover:bg-hover transition-all"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </button>

        {/* User + logout */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-dim
                       hover:text-text hover:bg-hover transition-all"
          >
            <LogOut size={16} />
            <span className="truncate">{user.name || user.email}</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="TechSpar" className="w-7 h-7 rounded-lg object-contain" />
          <span className="text-base font-display font-bold text-text">TechSpar</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-9 h-9 rounded-lg bg-hover border border-border flex items-center justify-center"
          aria-label="菜单"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex shrink-0">
        {nav}
      </div>

      {/* Mobile sidebar — slide overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="animate-fade-in">{nav}</div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
