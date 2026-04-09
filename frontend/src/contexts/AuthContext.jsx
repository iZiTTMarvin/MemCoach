import { createContext, useContext, useState, useEffect } from "react";
import { getProfile } from "../api/interview";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    let isMounted = true;
    if (token) {
      getProfile()
        .then((profileData) => {
          if (!isMounted) return;
          if (profileData) {
            // 合并：画像数据 + localStorage 中登录时存储的身份信息（email, name, id）
            const stored = localStorage.getItem("user");
            const authInfo = stored ? JSON.parse(stored) : {};
            setUser({ ...profileData, ...authInfo });
          } else {
            const stored = localStorage.getItem("user");
            if (stored) setUser(JSON.parse(stored));
            else logout();
          }
        })
        .catch(() => {
          if (isMounted) logout();
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      // Use setTimeout to avoid synchronous setState warning
      setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 0);
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  function login(newToken, userData) {
    localStorage.setItem("token", newToken);
    if (userData) localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData || null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
