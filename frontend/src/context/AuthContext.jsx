import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

// Mock users database
const mockUsers = [
  {
    id: 1,
    email: "admin@dsgtransport.com",
    password: "admin123",
    name: "Admin User",
    role: "Administrator",
    initials: "AU",
    joinedDate: "December 21, 2025",
  },
  {
    id: 2,
    email: "john.smith@dsgtransport.com",
    password: "john123",
    name: "John Smith",
    role: "User",
    initials: "JS",
    joinedDate: "January 5, 2025",
  },
  {
    id: 3,
    email: "sarah.johnson@dsgtransport.com",
    password: "sarah123",
    name: "Sarah Johnson",
    role: "User",
    initials: "SJ",
    joinedDate: "January 10, 2025",
  },
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toolCredentials, setToolCredentials] = useState({});

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("dsg_user");
    const savedCredentials = localStorage.getItem("dsg_tool_credentials");
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    if (savedCredentials) {
      setToolCredentials(JSON.parse(savedCredentials));
    }
    setIsLoading(false);
  }, []);

  // SSO Login function
  const login = async (email, password) => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const foundUser = mockUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem("dsg_user", JSON.stringify(userWithoutPassword));
      return { success: true };
    }
    
    return { success: false, error: "Invalid email or password" };
  };

  // SSO Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem("dsg_user");
    // Keep credentials in localStorage for the user
  };

  // Add/Update tool credentials for current user
  const saveToolCredential = (toolId, credential) => {
    if (!user) return;
    
    const userCredKey = `user_${user.id}`;
    const updatedCredentials = {
      ...toolCredentials,
      [userCredKey]: {
        ...toolCredentials[userCredKey],
        [toolId]: [
          ...(toolCredentials[userCredKey]?.[toolId] || []).filter(
            (c) => c.id !== credential.id
          ),
          credential,
        ],
      },
    };
    
    setToolCredentials(updatedCredentials);
    localStorage.setItem("dsg_tool_credentials", JSON.stringify(updatedCredentials));
  };

  // Add new credential for a tool
  const addToolCredential = (toolId, username, password, label = "") => {
    if (!user) return;
    
    const credential = {
      id: Date.now(),
      username,
      password, // In real app, this would be encrypted
      label: label || `Account ${(getUserToolCredentials(toolId)?.length || 0) + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveToolCredential(toolId, credential);
    return credential;
  };

  // Update existing credential
  const updateToolCredential = (toolId, credentialId, updates) => {
    if (!user) return;
    
    const userCredKey = `user_${user.id}`;
    const existingCreds = toolCredentials[userCredKey]?.[toolId] || [];
    const credIndex = existingCreds.findIndex((c) => c.id === credentialId);
    
    if (credIndex === -1) return;
    
    const updatedCred = {
      ...existingCreds[credIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    saveToolCredential(toolId, updatedCred);
  };

  // Delete credential
  const deleteToolCredential = (toolId, credentialId) => {
    if (!user) return;
    
    const userCredKey = `user_${user.id}`;
    const updatedCredentials = {
      ...toolCredentials,
      [userCredKey]: {
        ...toolCredentials[userCredKey],
        [toolId]: (toolCredentials[userCredKey]?.[toolId] || []).filter(
          (c) => c.id !== credentialId
        ),
      },
    };
    
    setToolCredentials(updatedCredentials);
    localStorage.setItem("dsg_tool_credentials", JSON.stringify(updatedCredentials));
  };

  // Get credentials for a specific tool for current user
  const getUserToolCredentials = (toolId) => {
    if (!user) return [];
    const userCredKey = `user_${user.id}`;
    return toolCredentials[userCredKey]?.[toolId] || [];
  };

  // Check if user has credentials for a tool
  const hasCredentialsForTool = (toolId) => {
    return getUserToolCredentials(toolId).length > 0;
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    addToolCredential,
    updateToolCredential,
    deleteToolCredential,
    getUserToolCredentials,
    hasCredentialsForTool,
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
