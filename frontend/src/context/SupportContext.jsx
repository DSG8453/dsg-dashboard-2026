import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { issuesAPI, settingsAPI } from "@/services/api";

const SupportContext = createContext(null);

const defaultSettings = {
  whatsapp_number: "+1234567890",
  support_email: "support@dsgtransport.com",
  business_hours: "Mon-Fri 9AM-6PM EST",
};

export const SupportProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch settings and issues on mount
  const fetchData = useCallback(async () => {
    try {
      // Fetch settings
      try {
        const settingsData = await settingsAPI.getSupport();
        setSettings(settingsData);
      } catch {
        console.log("Using default settings");
      }

      // Fetch issues
      try {
        const issuesData = await issuesAPI.getAll();
        setIssues(issuesData);
      } catch {
        console.log("Failed to fetch issues");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if user is logged in
    const token = localStorage.getItem("dsg_token");
    if (token) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [fetchData]);

  // Save settings
  const updateSettings = async (newSettings) => {
    try {
      const updated = await settingsAPI.updateSupport(newSettings);
      setSettings(updated);
      return updated;
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  };

  // Report new issue
  const reportIssue = async (issueData) => {
    try {
      const newIssue = await issuesAPI.create(issueData);
      setIssues([newIssue, ...issues]);
      return newIssue;
    } catch (error) {
      console.error("Failed to report issue:", error);
      throw error;
    }
  };

  // Send to Emergent AI for analysis
  const analyzeWithAI = async (issueId) => {
    try {
      const analysis = await issuesAPI.analyze(issueId);
      // Update local state
      setIssues(issues.map((i) =>
        i.id === issueId ? { ...i, ai_analysis: analysis, status: "analyzed" } : i
      ));
      return analysis;
    } catch (error) {
      console.error("Failed to analyze issue:", error);
      throw error;
    }
  };

  // Update issue
  const updateIssue = async (issueId, updates) => {
    try {
      const updated = await issuesAPI.update(issueId, updates);
      setIssues(issues.map((i) => i.id === issueId ? { ...i, ...updated } : i));
      return updated;
    } catch (error) {
      console.error("Failed to update issue:", error);
      throw error;
    }
  };

  // Resolve issue and notify user
  const resolveIssue = async (issueId, note) => {
    try {
      await issuesAPI.resolve(issueId, note);
      setIssues(issues.map((i) =>
        i.id === issueId ? { ...i, status: "resolved" } : i
      ));
    } catch (error) {
      console.error("Failed to resolve issue:", error);
      throw error;
    }
  };

  // Delete issue
  const deleteIssue = async (issueId) => {
    try {
      await issuesAPI.delete(issueId);
      setIssues(issues.filter((i) => i.id !== issueId));
    } catch (error) {
      console.error("Failed to delete issue:", error);
      throw error;
    }
  };

  // Get issues for a specific user
  const getUserIssues = (userId) => {
    return issues.filter((i) => i.user_id === userId);
  };

  // Get WhatsApp link
  const getWhatsAppLink = (message = "") => {
    const phone = settings.whatsapp_number.replace(/[^0-9]/g, "");
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}${message ? `?text=${encodedMessage}` : ""}`;
  };

  // Refresh issues
  const refreshIssues = useCallback(async () => {
    try {
      const issuesData = await issuesAPI.getAll();
      setIssues(issuesData);
    } catch (error) {
      console.error("Failed to refresh issues:", error);
    }
  }, []);

  const value = {
    settings,
    issues,
    isLoading,
    updateSettings,
    reportIssue,
    analyzeWithAI,
    updateIssue,
    resolveIssue,
    deleteIssue,
    getUserIssues,
    getWhatsAppLink,
    refreshIssues,
  };

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
};

export const useSupport = () => {
  const context = useContext(SupportContext);
  if (!context) {
    throw new Error("useSupport must be used within a SupportProvider");
  }
  return context;
};
