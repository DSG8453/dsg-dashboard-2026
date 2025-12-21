import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Key,
  User,
  ExternalLink,
  Shield,
  Check,
  X,
  Loader2,
} from "lucide-react";

export const ToolCredentialsDialog = ({ 
  tool, 
  open, 
  onOpenChange, 
  initialCredentials = [],
  isLoading = false,
  onCredentialsChange
}) => {
  const { addToolCredential, updateToolCredential, deleteToolCredential, revealPassword } = useAuth();
  const [credentials, setCredentials] = useState(initialCredentials);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    username: "",
    password: "",
  });

  // Update credentials when initialCredentials changes
  useEffect(() => {
    setCredentials(initialCredentials);
  }, [initialCredentials]);

  const resetForm = () => {
    setFormData({ label: "", username: "", password: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!formData.username || !formData.password) {
      toast.error("Please enter username and password");
      return;
    }

    setIsSaving(true);
    try {
      await addToolCredential(tool.id, formData.username, formData.password, formData.label || "Default Account");
      toast.success("Credentials saved!", {
        description: "Your login credentials have been securely stored.",
      });
      resetForm();
      // Refresh credentials list
      if (onCredentialsChange) {
        onCredentialsChange();
      }
    } catch (error) {
      toast.error(`Failed to save credentials: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (credId) => {
    if (!formData.username) {
      toast.error("Please enter username");
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        username: formData.username,
        label: formData.label,
      };
      if (formData.password) {
        updates.password = formData.password;
      }
      await updateToolCredential(credId, updates);
      toast.success("Credentials updated!");
      resetForm();
      if (onCredentialsChange) {
        onCredentialsChange();
      }
    } catch (error) {
      toast.error(`Failed to update credentials: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (credId) => {
    try {
      await deleteToolCredential(credId);
      toast.success("Credentials removed");
      setCredentials(credentials.filter(c => c.id !== credId));
      if (onCredentialsChange) {
        onCredentialsChange();
      }
    } catch (error) {
      toast.error(`Failed to delete credentials: ${error.message}`);
    }
  };

  const startEdit = (cred) => {
    setEditingId(cred.id);
    setFormData({
      label: cred.label,
      username: cred.username,
      password: "", // Don't pre-fill password
    });
  };

  const togglePasswordVisibility = async (credId) => {
    const isCurrentlyVisible = showPasswords[credId];
    
    if (!isCurrentlyVisible && !revealedPasswords[credId]) {
      // Need to reveal password from backend
      try {
        const password = await revealPassword(credId);
        setRevealedPasswords(prev => ({ ...prev, [credId]: password }));
        setShowPasswords(prev => ({ ...prev, [credId]: true }));
      } catch (error) {
        toast.error("Failed to reveal password");
      }
    } else {
      setShowPasswords(prev => ({ ...prev, [credId]: !prev[credId] }));
    }
  };

  const launchTool = (cred) => {
    if (tool.url && tool.url !== "#") {
      navigator.clipboard.writeText(cred.username);
      toast.success("Username copied!", {
        description: "Opening tool... Paste your username, then use your saved password.",
      });
      window.open(tool.url, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Tool URL not configured");
    }
  };

  const maskPassword = () => "••••••••";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            {tool?.name} Credentials
          </DialogTitle>
          <DialogDescription>
            Manage your login credentials for this tool. Credentials are stored securely and only visible to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Security Notice */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Your credentials are encrypted and only accessible by you
            </span>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Existing Credentials */}
              {credentials.length > 0 && (
                <div className="space-y-3">
                  <Label>Saved Credentials</Label>
                  {credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="p-4 rounded-lg border border-border bg-card"
                    >
                      {editingId === cred.id ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <Input
                            placeholder="Label (optional)"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                          />
                          <Input
                            placeholder="Username / Email"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          />
                          <Input
                            type="password"
                            placeholder="New Password (leave empty to keep current)"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="gradient"
                              onClick={() => handleUpdate(cred.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={resetForm}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{cred.label}</Badge>
                            <div className="flex gap-1">
                              <Button
                                size="iconSm"
                                variant="ghost"
                                onClick={() => togglePasswordVisibility(cred.id)}
                              >
                                {showPasswords[cred.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="iconSm"
                                variant="ghost"
                                onClick={() => startEdit(cred)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="iconSm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(cred.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Username:</span>
                              <span className="font-medium">{cred.username}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Key className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Password:</span>
                              <span className="font-mono">
                                {showPasswords[cred.id] && revealedPasswords[cred.id] 
                                  ? revealedPasswords[cred.id] 
                                  : maskPassword()}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="gradient"
                            className="w-full mt-3 gap-2"
                            onClick={() => launchTool(cred)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Launch with this account
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add New Credentials */}
              {isAdding ? (
                <div className="space-y-3">
                  <Label>Add New Credentials</Label>
                  <Input
                    placeholder="Label (e.g., Work Account, Personal)"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  />
                  <Input
                    placeholder="Username / Email"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="gradient" 
                      onClick={handleAdd} 
                      className="flex-1"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Save Credentials
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add New Credentials
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
