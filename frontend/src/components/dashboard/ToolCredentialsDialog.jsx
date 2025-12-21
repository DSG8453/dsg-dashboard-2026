import { useState } from "react";
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
} from "lucide-react";

export const ToolCredentialsDialog = ({ tool, open, onOpenChange }) => {
  const { getUserToolCredentials, addToolCredential, updateToolCredential, deleteToolCredential } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [formData, setFormData] = useState({
    label: "",
    username: "",
    password: "",
  });

  const credentials = getUserToolCredentials(tool?.id) || [];

  const resetForm = () => {
    setFormData({ label: "", username: "", password: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!formData.username || !formData.password) {
      toast.error("Please enter username and password");
      return;
    }

    addToolCredential(tool.id, formData.username, formData.password, formData.label);
    toast.success("Credentials saved!", {
      description: "Your login credentials have been securely stored.",
    });
    resetForm();
  };

  const handleUpdate = (credId) => {
    if (!formData.username || !formData.password) {
      toast.error("Please enter username and password");
      return;
    }

    updateToolCredential(tool.id, credId, {
      username: formData.username,
      password: formData.password,
      label: formData.label,
    });
    toast.success("Credentials updated!");
    resetForm();
  };

  const handleDelete = (credId) => {
    deleteToolCredential(tool.id, credId);
    toast.success("Credentials removed");
  };

  const startEdit = (cred) => {
    setEditingId(cred.id);
    setFormData({
      label: cred.label,
      username: cred.username,
      password: cred.password,
    });
  };

  const togglePasswordVisibility = (credId) => {
    setShowPasswords((prev) => ({ ...prev, [credId]: !prev[credId] }));
  };

  const launchTool = (cred) => {
    // In a real implementation, this would use a secure method to auto-fill credentials
    // For now, we'll copy credentials and open the tool
    if (tool.url && tool.url !== "#") {
      // Copy username to clipboard
      navigator.clipboard.writeText(cred.username);
      toast.success("Username copied!", {
        description: "Opening tool... Paste your username, then use your saved password.",
      });
      window.open(tool.url, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Tool URL not configured");
    }
  };

  const maskPassword = (password) => "•".repeat(Math.min(password.length, 12));

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
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="gradient"
                          onClick={() => handleUpdate(cred.id)}
                        >
                          <Check className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resetForm}
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
                            {showPasswords[cred.id] ? cred.password : maskPassword(cred.password)}
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
                <Button variant="gradient" onClick={handleAdd} className="flex-1">
                  <Check className="h-4 w-4 mr-1" /> Save Credentials
                </Button>
                <Button variant="outline" onClick={resetForm}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
