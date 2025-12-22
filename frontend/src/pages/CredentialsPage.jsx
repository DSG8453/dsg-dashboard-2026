import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usersAPI } from "@/services/api";
import { copyToClipboard } from "@/lib/utils";
import { 
  Search, 
  Key, 
  Mail, 
  Send, 
  Eye, 
  EyeOff, 
  Copy, 
  MoreVertical,
  RefreshCw,
  Trash2,
  Shield,
  Lock,
  Unlock,
  Loader2,
  Users,
  Check,
  KeyRound
} from "lucide-react";

export const CredentialsPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "Super Administrator";
  
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPasswords, setShowPasswords] = useState({});
  
  // Dialog states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState(null);

  // Fetch user credentials
  useEffect(() => {
    if (isSuperAdmin) {
      fetchCredentials();
    } else {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const data = await usersAPI.getAllCredentials();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load credentials");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Handle copy to clipboard with toast feedback
  const handleCopy = async (text, label) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success(`${label} copied to clipboard`);
    } else {
      // Show the text in toast for manual copy
      toast.info(`${label}: ${text}`, { 
        duration: 8000,
        description: "Select and copy manually (Ctrl+C)"
      });
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    setIsSaving(true);
    try {
      await usersAPI.resetPassword(selectedUser.id, newPassword);
      toast.success(`Password reset for ${selectedUser.name}`);
      setResetDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
      fetchCredentials(); // Refresh list
    } catch (error) {
      toast.error(`Failed to reset password: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Send password reset email
  const handleSendPasswordReset = async (userItem) => {
    try {
      const result = await usersAPI.sendPasswordReset(userItem.id);
      setGeneratedPassword({
        user: userItem,
        password: result.new_password,
        emailSent: result.email_sent
      });
      toast.success(`Password reset sent to ${userItem.email}`);
      fetchCredentials();
    } catch (error) {
      toast.error(`Failed to send password reset: ${error.message}`);
    }
  };

  // Toggle 2SV
  const handleToggle2SV = async (userItem, enabled) => {
    try {
      await usersAPI.toggle2SV(userItem.id, enabled);
      setUsers(users.map(u => 
        u.id === userItem.id ? { ...u, two_sv_enabled: enabled } : u
      ));
      toast.success(`2SV ${enabled ? 'enabled' : 'disabled'} for ${userItem.name}`);
    } catch (error) {
      toast.error(`Failed to update 2SV: ${error.message}`);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await usersAPI.delete(selectedUser.id);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      toast.success(`${selectedUser.name} deleted`);
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(`Failed to delete user: ${error.message}`);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Access restricted for non-Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Administrator can view user credentials.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Credentials</h1>
          <p className="text-muted-foreground">
            Manage all user login credentials securely
          </p>
        </div>
        <Button variant="outline" onClick={fetchCredentials} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Warning Card */}
      <Card className="mb-6 border-warning/20 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Sensitive Information</p>
              <p className="text-sm text-muted-foreground">
                This page contains user passwords. Keep this information secure and only share through official channels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          className="pl-10 max-w-md"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Credentials Table */}
      <Card className="border-2 border-border/50 shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>2SV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((userItem) => (
                <TableRow key={userItem.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {userItem.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{userItem.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm">{userItem.email}</code>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => handleCopy(userItem.email, "Email")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {showPasswords[userItem.id] ? userItem.password : "••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => togglePasswordVisibility(userItem.id)}
                      >
                        {showPasswords[userItem.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      {showPasswords[userItem.id] && (
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleCopy(userItem.password, "Password")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      userItem.role === "Super Administrator" ? "admin" :
                      userItem.role === "Administrator" ? "admin" : "user"
                    }>
                      {userItem.role === "Super Administrator" ? "Super Admin" : 
                       userItem.role === "Administrator" ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {userItem.role === "Super Administrator" ? (
                        <Badge variant="success" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Always On
                        </Badge>
                      ) : (
                        <Switch
                          checked={userItem.two_sv_enabled}
                          onCheckedChange={(checked) => handleToggle2SV(userItem, checked)}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={userItem.status === "Active" ? "success" : "warning"}>
                      {userItem.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="iconSm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedUser(userItem);
                          setNewPassword("");
                          setResetDialogOpen(true);
                        }}>
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendPasswordReset(userItem)}>
                          <Send className="mr-2 h-4 w-4" />
                          Send Password Reset Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(
                          `Email: ${userItem.email}\nPassword: ${userItem.password}`,
                          "Credentials"
                        )}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Credentials
                        </DropdownMenuItem>
                        {userItem.role !== "Super Administrator" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm"><strong>User:</strong> {selectedUser?.name}</p>
              <p className="text-sm"><strong>Email:</strong> {selectedUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="text"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setResetDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="gradient" className="flex-1" onClick={handleResetPassword} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generated Password Dialog */}
      <Dialog open={!!generatedPassword} onOpenChange={() => setGeneratedPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              Password Reset Sent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm mb-2">New password generated for <strong>{generatedPassword?.user?.name}</strong>:</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono bg-white p-2 rounded flex-1">
                  {generatedPassword?.password}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(generatedPassword?.password, "Password")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {generatedPassword?.emailSent ? (
              <p className="text-sm text-success flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email sent to {generatedPassword?.user?.email}
              </p>
            ) : (
              <p className="text-sm text-warning flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email could not be sent. Please share the password manually.
              </p>
            )}
            <Button className="w-full" onClick={() => setGeneratedPassword(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
