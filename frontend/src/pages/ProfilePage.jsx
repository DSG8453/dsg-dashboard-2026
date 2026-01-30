import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Edit,
  Key,
  Bell,
  ExternalLink,
} from "lucide-react";

export const ProfilePage = ({ currentUser }) => {
  const handleEditProfile = () => {
    toast.info("Edit Profile", {
      description: "Profile editing functionality - coming soon!",
    });
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "Super Administrator":
        return "superadmin";
      case "Administrator":
        return "admin";
      default:
        return "secondary";
    }
  };

  const getAccessLevelBadge = (level) => {
    switch (level) {
      case "full":
        return { variant: "success", label: "Full Access" };
      case "standard":
        return { variant: "secondary", label: "Standard" };
      case "restricted":
        return { variant: "warning", label: "Restricted" };
      default:
        return { variant: "secondary", label: level };
    }
  };

  const accessBadge = getAccessLevelBadge(currentUser?.access_level);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview Card */}
        <Card className="lg:col-span-2 border-2 border-border/50 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleEditProfile}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar and Name Section */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-primary/20">
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white">
                  {currentUser?.initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{currentUser?.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getRoleBadgeVariant(currentUser?.role)}>
                    {currentUser?.role}
                  </Badge>
                  <Badge variant={accessBadge.variant}>{accessBadge.label}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{currentUser?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Account Status</p>
                  <Badge variant="success">{currentUser?.status || "Active"}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {currentUser?.joined_date
                      ? new Date(currentUser.joined_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Key className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Login Method</p>
                  <p className="font-medium flex items-center gap-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google SSO
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="border-2 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Account Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account is secured with Google Single Sign-On. Manage your Google account settings to update your profile or security options.
            </p>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => window.open('https://myaccount.google.com/', '_blank')}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Manage Google Account
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <p className="font-medium text-primary mb-1">🔒 Secure Authentication</p>
              <p className="text-muted-foreground text-xs">
                Your account uses Google SSO for enhanced security. No passwords to remember!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Info Card */}
      <Card className="border-2 border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Secure Tool Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tool credentials are securely managed by your administrator. When you access a tool,
            credentials are handled entirely server-side - they are never exposed to your browser.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <h4 className="font-medium text-success mb-1">🔐 Zero Credential Exposure</h4>
              <p className="text-xs text-muted-foreground">
                Passwords are stored in Google Secret Manager and never sent to the frontend.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h4 className="font-medium text-primary mb-1">🛡️ Secure Gateway</h4>
              <p className="text-xs text-muted-foreground">
                All tool access goes through a secure backend gateway with session management.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <h4 className="font-medium text-warning mb-1">📋 Audit Trail</h4>
              <p className="text-xs text-muted-foreground">
                All tool access is logged and monitored for security compliance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
