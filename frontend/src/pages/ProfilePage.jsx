import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authAPI } from "@/services/api";
import { toast } from "sonner";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Edit,
  Key,
  Bell,
  Puzzle,
  Download,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";

export const ProfilePage = ({ currentUser }) => {
  const [extensionId, setExtensionId] = useState("");
  const [isExtensionSaved, setIsExtensionSaved] = useState(false);
  
  // Change Password Dialog state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load saved extension ID on mount
  useEffect(() => {
    const savedId = localStorage.getItem('dsg_extension_id');
    if (savedId) {
      setExtensionId(savedId);
      setIsExtensionSaved(true);
    }
  }, []);

  const handleEditProfile = () => {
    toast.info("Edit Profile", {
      description: "Profile editing functionality - coming soon!",
    });
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmitPasswordChange = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully!");
      setShowChangePassword(false);
    } catch (error) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveExtensionId = () => {
    if (!extensionId.trim()) {
      toast.error("Please enter your Extension ID");
      return;
    }
    
    localStorage.setItem('dsg_extension_id', extensionId.trim());
    setIsExtensionSaved(true);
    toast.success("Extension ID Saved!", {
      description: "You can now use auto-login for tools",
    });
  };

  const handleClearExtensionId = () => {
    localStorage.removeItem('dsg_extension_id');
    setExtensionId("");
    setIsExtensionSaved(false);
    toast.info("Extension ID Removed");
  };

  const handleDownloadExtension = () => {
    // Open in new window - forces browser to handle the download
    const downloadUrl = `${process.env.REACT_APP_BACKEND_URL}/api/download/extension`;
    const newWindow = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    
    // If popup was blocked, try direct navigation
    if (!newWindow) {
      window.location.assign(downloadUrl);
    }
    
    toast.info("Download starting...", {
      description: "If download doesn't start, check your popup blocker",
    });
  };

  const copyExtensionId = () => {
    navigator.clipboard.writeText(extensionId);
    toast.success("Extension ID copied!");
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Card className="border-2 border-border/50 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-3xl font-bold">
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl font-bold">My Profile</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <Separator />

          {/* Profile Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Full Name
                </p>
                <p className="text-foreground font-semibold">
                  {currentUser.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Email Address
                </p>
                <p className="text-foreground font-semibold">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="p-2 rounded-lg bg-admin/10">
                <Shield className="h-5 w-5 text-admin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Role
                </p>
                <Badge variant="admin">{currentUser.role}</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="p-2 rounded-lg bg-success/10">
                <Calendar className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Member Since
                </p>
                <p className="text-foreground font-semibold">
                  {currentUser.joinedDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="p-2 rounded-lg bg-success/10">
                <Bell className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Account Status
                </p>
                <Badge variant="active">Active</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              onClick={handleEditProfile}
            >
              <Edit className="h-4 w-4" />
              Edit Profile
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleChangePassword}
            >
              <Key className="h-4 w-4" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Browser Extension Section */}
      <Card className="border-2 border-border/50 shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            Browser Extension
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-Install Notice for Regular Users */}
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm font-medium text-success flex items-center gap-2">
              <Check className="h-4 w-4" />
              Auto-Install Enabled via Google Workspace
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              The DSG Transport extension is <strong>automatically installed</strong> on all company Chrome browsers. 
              If you don't see it, make sure you're signed into Chrome with your company Google account.
            </p>
          </div>

          {/* Extension Status Check */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Extension Status</Label>
            <div className="flex gap-2">
              <Input
                id="extensionId"
                placeholder="Extension ID will auto-detect..."
                value={extensionId}
                onChange={(e) => {
                  setExtensionId(e.target.value);
                  setIsExtensionSaved(false);
                }}
                className="flex-1"
                readOnly={isExtensionSaved}
              />
              {extensionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyExtensionId}
                  title="Copy ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Save / Clear Buttons */}
          <div className="flex gap-2">
            <Button
              variant={isExtensionSaved ? "outline" : "gradient"}
              className="flex-1 gap-2"
              onClick={handleSaveExtensionId}
              disabled={!extensionId.trim() || isExtensionSaved}
            >
              {isExtensionSaved ? (
                <>
                  <Check className="h-4 w-4 text-success" />
                  Connected
                </>
              ) : (
                "Connect Extension"
              )}
            </Button>
            {isExtensionSaved && (
              <Button
                variant="destructive"
                onClick={handleClearExtensionId}
              >
                Disconnect
              </Button>
            )}
          </div>

          {/* Connected Status */}
          {isExtensionSaved && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-success font-medium flex items-center gap-2">
                <Check className="h-4 w-4" />
                Extension Connected - Auto-Login Ready
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Open Tool" on any tool to login automatically. No passwords needed!
              </p>
            </div>
          )}

          <Separator />

          {/* Super Admin Only: Manual Setup Section */}
          {currentUser?.role === 'Super Administrator' && (
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-admin" />
                Admin: Manual Install / Download
              </p>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleDownloadExtension}
                >
                  <Download className="h-4 w-4" />
                  Download Extension ZIP
                </Button>
                
                <a 
                  href="/dsg-transport-extension.zip"
                  download="dsg-transport-extension.zip"
                  className="block"
                >
                  <Button variant="ghost" className="w-full gap-2 text-xs">
                    <ExternalLink className="h-3 w-3" />
                    Direct Link (Right-click → Save As)
                  </Button>
                </a>

                <div className="text-xs text-muted-foreground space-y-1 mt-2">
                  <p className="font-medium">Google Workspace Deployment:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Go to <code className="bg-muted px-1 rounded">admin.google.com</code></li>
                    <li>Devices → Chrome → Apps & extensions</li>
                    <li>Add extension with update URL below</li>
                  </ul>
                  <div className="mt-2 p-2 bg-background rounded border">
                    <code className="text-[10px] break-all select-all">
                      {window.location.origin}/extension-update.xml
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Help */}
          <div className="p-3 rounded-lg bg-muted/50 text-xs">
            <p className="font-medium mb-2">Not seeing the extension?</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Sign into Chrome with your <strong>company Google account</strong></li>
              <li>Go to <code className="bg-muted px-1 rounded">chrome://extensions</code></li>
              <li>Look for "DSG Transport Secure Login"</li>
              <li>If missing, contact your IT administrator</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};