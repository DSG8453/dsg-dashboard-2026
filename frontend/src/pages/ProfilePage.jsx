import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

export const ProfilePage = ({ currentUser }) => {
  const [extensionId, setExtensionId] = useState("");
  const [isExtensionSaved, setIsExtensionSaved] = useState(false);

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
    toast.info("Change Password", {
      description: "Password change functionality - coming soon!",
    });
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
          <p className="text-sm text-muted-foreground">
            Install the DSG Transport browser extension for <strong>automatic login</strong> to tools. 
            You won't need to enter passwords - credentials are filled automatically and securely.
          </p>

          {/* Download Button - From same origin (public folder) */}
          <a
            href="/dsg-transport-extension.zip"
            download="dsg-transport-extension.zip"
            style={{ textDecoration: 'none', width: '100%', display: 'block' }}
          >
            <Button
              variant="outline"
              className="w-full gap-2"
              type="button"
            >
              <Download className="h-4 w-4" />
              Download Extension
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>

          <Separator />

          {/* Extension ID Input */}
          <div className="space-y-2">
            <Label htmlFor="extensionId" className="text-sm font-medium">
              Extension ID
            </Label>
            <p className="text-xs text-muted-foreground">
              After installing, go to <code className="bg-muted px-1 rounded">chrome://extensions</code> and copy your extension ID
            </p>
            <div className="flex gap-2">
              <Input
                id="extensionId"
                placeholder="e.g., abcdefghijklmnopqrstuvwxyz..."
                value={extensionId}
                onChange={(e) => {
                  setExtensionId(e.target.value);
                  setIsExtensionSaved(false);
                }}
                className="flex-1"
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
                  Saved
                </>
              ) : (
                "Save Extension ID"
              )}
            </Button>
            {isExtensionSaved && (
              <Button
                variant="destructive"
                onClick={handleClearExtensionId}
              >
                Remove
              </Button>
            )}
          </div>

          {/* Status */}
          {isExtensionSaved && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-success font-medium flex items-center gap-2">
                <Check className="h-4 w-4" />
                Extension Connected
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-login is enabled. Click "Open Tool" on any tool to login automatically.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-2">
            <p className="font-medium">How to install:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click "Download Extension" above</li>
              <li>Extract the ZIP file to a folder</li>
              <li>Open Chrome → <code className="bg-muted px-1 rounded">chrome://extensions</code></li>
              <li>Enable "Developer mode" (top-right toggle)</li>
              <li>Click "Load unpacked" → Select the folder</li>
              <li>Copy the Extension ID and paste it above</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};