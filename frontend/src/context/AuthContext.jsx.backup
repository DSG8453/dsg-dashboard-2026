import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authAPI, credentialsAPI, devicesAPI } from "@/services/api";
import { getDeviceInfo, setStoredDeviceStatus, clearStoredDeviceStatus } from "@/utils/deviceFingerprint";
import { NotificationType } from "@/hooks/useWebSocket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState(null); // 'pending', 'approved', 'rejected', 'revoked'
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  // Logout function - defined early so it can be used in WebSocket handler
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setDeviceStatus(null);
    setDeviceInfo(null);
    localStorage.removeItem("dsg_token");
    localStorage.removeItem("dsg_user");
    clearStoredDeviceStatus();
  }, []);
  
  // WebSocket connection effect
  useEffect(() => {
    if (!token) return;
    
    const connectWebSocket = () => {
      // Get WebSocket URL from backend URL
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws/${token}`;
      
      try {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('[WS] Connected');
          setWsConnected(true);
          
          // Start ping interval
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send('ping');
            }
          }, 30000);
        };
        
        wsRef.current.onmessage = (event) => {
          if (event.data === 'pong') return;
          
          try {
            const data = JSON.parse(event.data);
            console.log('[WS] Message received:', data);
            
            // Handle notification
            switch (data.type) {
              case NotificationType.TOOL_ACCESS_UPDATED:
              case NotificationType.TOOL_DELETED:
              case NotificationType.TOOL_CREATED:
              case NotificationType.REFRESH_DASHBOARD:
                setDashboardRefreshKey(prev => prev + 1);
                break;
                
              case NotificationType.ROLE_CHANGED:
                if (data.new_role) {
                  setUser(prev => prev ? { ...prev, role: data.new_role } : prev);
                }
                setDashboardRefreshKey(prev => prev + 1);
                break;
                
              case NotificationType.USER_SUSPENDED:
                setTimeout(() => {
                  logout();
                  window.location.href = '/login';
                }, 3000);
                break;
                
              default:
                break;
            }
          } catch (error) {
            console.error('[WS] Error parsing message:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('[WS] Disconnected');
          setWsConnected(false);
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('[WS] Error:', error);
        };
      } catch (error) {
        console.error('[WS] Connection error:', error);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [token, logout]);

  // Register device and check approval status
  const registerDevice = useCallback(async (currentUser) => {
    try {
      const info = await getDeviceInfo();
      setDeviceInfo(info);
      
      const result = await devicesAPI.register({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_email: currentUser.email,
        ...info,
      });
      
      setDeviceStatus(result.status);
      setStoredDeviceStatus({ status: result.status, deviceId: result.id });
      
      return result;
    } catch (error) {
      console.error("Failed to register device:", error);
      // If device registration fails, allow access (fallback)
      setDeviceStatus("approved");
      return { status: "approved", approved: true };
    }
  }, []);

  // Check device status
  const checkDeviceStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      const info = await getDeviceInfo();
      const result = await devicesAPI.checkDevice(info.fingerprint);
      setDeviceStatus(result.status);
      setStoredDeviceStatus({ status: result.status, deviceId: result.device_id });
      return result;
    } catch (error) {
      console.error("Failed to check device:", error);
      return { status: "approved", approved: true };
    }
  }, [user]);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem("dsg_token");
      const savedUser = localStorage.getItem("dsg_user");
      
      if (savedToken && savedUser) {
        setToken(savedToken);
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        try {
          // Verify token is still valid
          const userData = await authAPI.getMe();
          setUser(userData);
          localStorage.setItem("dsg_user", JSON.stringify(userData));
          
          // Register/check device
          await registerDevice(userData);
        } catch (error) {
          // Token invalid, clear session
          logout();
        }
      }
      
      setIsLoading(false);
    };
    
    initAuth();
  }, [logout, registerDevice]);

  // Login user - now supports 2SV
  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      
      // Check if 2SV is required
      if (response.requires_otp) {
        return { 
          success: true, 
          requiresOtp: true,
          tempToken: response.temp_token,
          message: response.message
        };
      }
      
      // No 2SV - direct login
      localStorage.setItem("dsg_token", response.access_token);
      localStorage.setItem("dsg_user", JSON.stringify(response.user));
      
      setToken(response.access_token);
      setUser(response.user);
      
      // Register device after login
      const deviceResult = await registerDevice(response.user);
      
      return { 
        success: true, 
        requiresOtp: false,
        deviceApproved: deviceResult.approved,
        deviceStatus: deviceResult.status 
      };
    } catch (error) {
      return { success: false, error: error.message || "Invalid email or password" };
    }
  };

  // Google OAuth Login (Legacy - Emergent)
  const loginWithGoogle = async (sessionId) => {
    try {
      const response = await authAPI.googleSession(sessionId);
      
      // Save token and user
      localStorage.setItem("dsg_token", response.access_token);
      localStorage.setItem("dsg_user", JSON.stringify(response.user));
      
      setToken(response.access_token);
      setUser(response.user);
      
      // Register device after login
      const deviceResult = await registerDevice(response.user);
      
      return { 
        success: true,
        user: response.user,
        deviceApproved: deviceResult.approved,
        deviceStatus: deviceResult.status 
      };
    } catch (error) {
      return { success: false, error: error.message || "Google login failed" };
    }
  };

  // Direct Token Login (New Google OAuth flow)
  const loginWithToken = async (jwtToken) => {
    try {
      // Save token first
      localStorage.setItem("dsg_token", jwtToken);
      setToken(jwtToken);
      
      // Fetch user data with the token
      const userData = await authAPI.getMe();
      
      // Save user data
      localStorage.setItem("dsg_user", JSON.stringify(userData));
      setUser(userData);
      
      // Register device after login
      const deviceResult = await registerDevice(userData);
      
      return { 
        success: true,
        user: userData,
        deviceApproved: deviceResult.approved,
        deviceStatus: deviceResult.status 
      };
    } catch (error) {
      // Clear token if getMe fails
      localStorage.removeItem("dsg_token");
      setToken(null);
      return { success: false, error: error.message || "Token login failed" };
    }
  };

  // Verify OTP for 2SV
  const verifyOtp = async (email, otp, tempToken) => {
    try {
      const response = await authAPI.verifyOtp({ email, otp, temp_token: tempToken });
      
      // Save token and user
      localStorage.setItem("dsg_token", response.access_token);
      localStorage.setItem("dsg_user", JSON.stringify(response.user));
      
      setToken(response.access_token);
      setUser(response.user);
      
      // Register device after login
      const deviceResult = await registerDevice(response.user);
      
      return { 
        success: true,
        deviceApproved: deviceResult.approved,
        deviceStatus: deviceResult.status 
      };
    } catch (error) {
      return { success: false, error: error.message || "Invalid OTP code" };
    }
  };

  // Resend OTP
  const resendOtp = async (tempToken) => {
    try {
      const response = await authAPI.resendOtp(tempToken);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: error.message || "Failed to resend OTP" };
    }
  };

  // Add credential for a tool
  const addToolCredential = async (toolId, username, password, label = "Default Account") => {
    if (!user) return null;
    
    try {
      const credential = await credentialsAPI.create({
        tool_id: toolId,
        label,
        username,
        password,
      });
      return credential;
    } catch (error) {
      console.error("Failed to add credential:", error);
      throw error;
    }
  };

  // Update existing credential
  const updateToolCredential = async (credentialId, updates) => {
    if (!user) return;
    
    try {
      const updated = await credentialsAPI.update(credentialId, updates);
      return updated;
    } catch (error) {
      console.error("Failed to update credential:", error);
      throw error;
    }
  };

  // Delete credential
  const deleteToolCredential = async (credentialId) => {
    if (!user) return;
    
    try {
      await credentialsAPI.delete(credentialId);
    } catch (error) {
      console.error("Failed to delete credential:", error);
      throw error;
    }
  };

  // Get credentials for a specific tool
  const getUserToolCredentials = async (toolId) => {
    if (!user) return [];
    
    try {
      const credentials = await credentialsAPI.getByTool(toolId);
      return credentials;
    } catch (error) {
      console.error("Failed to get credentials:", error);
      return [];
    }
  };

  // Reveal password for a credential
  const revealPassword = async (credentialId) => {
    if (!user) return null;
    
    try {
      const result = await credentialsAPI.reveal(credentialId);
      return result.password;
    } catch (error) {
      console.error("Failed to reveal password:", error);
      throw error;
    }
  };

  // Check if device is approved (ONLY Super Admin bypasses device approval)
  const isDeviceApproved = user?.role === "Super Administrator" || deviceStatus === "approved";

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    deviceStatus,
    deviceInfo,
    isDeviceApproved,
    wsConnected,
    dashboardRefreshKey,
    login,
    loginWithGoogle,
    loginWithToken,
    verifyOtp,
    resendOtp,
    logout,
    checkDeviceStatus,
    addToolCredential,
    updateToolCredential,
    deleteToolCredential,
    getUserToolCredentials,
    revealPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
