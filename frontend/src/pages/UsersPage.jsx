import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { usersAPI, toolsAPI } from "@/services/api";
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  MoreVertical,
  Shield,
  Ban,
  Mail,
  UserCheck,
  Loader2,
  Copy,
  MessageCircle,
  Check,
  AlertTriangle,
  Wrench,
  Package,
  Crown,
  Users,
} from "lucide-react";

import { useSupport } from "@/context/SupportContext";
import { useAuth } from "@/context/AuthContext";

const accessLevels = [
  { value: "full", label: "Full Access", description: "All tools and admin features" },
  { value: "standard", label: "Standard", description: "All tools, no admin features" },
  { value: "limited", label: "Limited", description: "Selected tools only" },
  { value: "readonly", label: "Read Only", description: "View only, no actions" },
];

// Role options - Super Admin can assign any role
const roleOptions = [
  { value: "Super Administrator", label: "Super Admin", description: "Full control over everything" },
  { value: "Administrator", label: "Admin", description: "Can assign tools to users" },
  { value: "User", label: "User", description: "Access assigned tools only" },
];

// Approved company domains
const APPROVED_DOMAINS = [
  "dsgtransport.net",
  "teamdsgtransport.com",
  "dsgtransport.com",
];

// Check if email domain is approved
const isApprovedDomain = (email) => {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return APPROVED_DOMAINS.includes(domain);
};

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const { settings, getWhatsAppLink } = useSupport();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Role checks
  const isSuperAdmin = currentUser?.role === "Super Administrator";
  const isAdmin = currentUser?.role === "Administrator";
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [externalDomainApproved, setExternalDomainApproved] = useState(false);
  const [sendInvitationEmail, setSendInvitationEmail] = useState(true);
  const [newUser, setNewUser] = useState({ 
    name: "", 
    email: "", 
    role: "User", 
    status: "Active",
    access_level: "standard" 
  });
  const [editUser, setEditUser] = useState(null);
  
  // Tool access management
  const [toolAccessDialogOpen, setToolAccessDialogOpen] = useState(false);
  const [toolAccessUser, setToolAccessUser] = useState(null);
  const [allTools, setAllTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // User assignment to Admin (Super Admin only)
  const [assignUsersDialogOpen, setAssignUsersDialogOpen] = useState(false);
  const [assignUsersAdmin, setAssignUsersAdmin] = useState(null);
  const [selectedUsersToAssign, setSelectedUsersToAssign] = useState([]);
  const [userAssignSearch, setUserAssignSearch] = useState("");

  // Get assigned users for current admin
  const [myAssignedUsers, setMyAssignedUsers] = useState([]);

  // Check if current email is external (non-approved domain)
  const isExternalEmail = newUser.email && newUser.email.includes("@") && !isApprovedDomain(newUser.email);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
    fetchTools();
  }, []);

  // Fetch current admin's assigned users when component mounts (for Admin role)
  useEffect(() => {
    if (isAdmin && currentUser?.id) {
      const currentUserData = users.find(u => u.id === currentUser.id);
      if (currentUserData) {
        setMyAssignedUsers(currentUserData.assigned_users || []);
      }
    }
  }, [isAdmin, currentUser?.id, users]);

  const fetchUsers = async () => {
    try {
      const data = await usersAPI.getAll();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTools = async () => {
    try {
      const data = await toolsAPI.getAll();
      setAllTools(data);
    } catch (error) {
      console.error("Failed to load tools:", error);
    }
  };

  // Check if current user can manage a specific user
  const canManageUser = (userId) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return myAssignedUsers.includes(userId);
    return false;
  };

  // Get tools that current user can assign to others
  // Super Admin can assign any tool
  // Admin can only assign tools they have access to
  const getAssignableTools = () => {
    if (isSuperAdmin) {
      return allTools;
    }
    if (isAdmin) {
      // Get current user from users list to find their allowed_tools
      const currentUserData = users.find(u => u.id === currentUser?.id);
      const myAllowedTools = currentUserData?.allowed_tools || [];
      // Admin can only assign tools that are assigned to them
      return allTools.filter(tool => myAllowedTools.includes(tool.id));
    }
    return [];
  };

  const handleOpenToolAccess = (user) => {
    setToolAccessUser(user);
    setSelectedTools(user.allowed_tools || []);
    setToolAccessDialogOpen(true);
  };

  const handleToggleTool = (toolId) => {
    const assignableTools = getAssignableTools();
    // Only allow toggling tools that the current user can assign
    if (!assignableTools.find(t => t.id === toolId)) {
      toast.error("You cannot assign this tool");
      return;
    }
    
    setSelectedTools(prev => {
      if (prev.includes(toolId)) {
        return prev.filter(id => id !== toolId);
      } else {
        return [...prev, toolId];
      }
    });
  };

  const handleSelectAllTools = () => {
    const assignableTools = getAssignableTools();
    const assignableIds = assignableTools.map(t => t.id);
    
    if (selectedTools.filter(id => assignableIds.includes(id)).length === assignableTools.length) {
      // Remove only assignable tools (keep any that admin can't control)
      setSelectedTools(prev => prev.filter(id => !assignableIds.includes(id)));
    } else {
      // Add all assignable tools
      setSelectedTools(prev => [...new Set([...prev, ...assignableIds])]);
    }
  };

  const handleSaveToolAccess = async () => {
    if (!toolAccessUser) return;
    
    setIsSaving(true);
    try {
      await usersAPI.updateToolAccess(toolAccessUser.id, selectedTools);
      // Update local state
      setUsers(users.map(u => 
        u.id === toolAccessUser.id ? { ...u, allowed_tools: selectedTools } : u
      ));
      toast.success(`Tool access updated for ${toolAccessUser.name}`, {
        description: `${selectedTools.length} tool(s) accessible`
      });
      setToolAccessDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to update tool access: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // === User Assignment to Admin (Super Admin only) ===
  const handleOpenAssignUsers = (admin) => {
    setAssignUsersAdmin(admin);
    setSelectedUsersToAssign(admin.assigned_users || []);
    setAssignUsersDialogOpen(true);
  };

  const handleToggleUserAssignment = (userId) => {
    setSelectedUsersToAssign(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSaveUserAssignment = async () => {
    if (!assignUsersAdmin) return;
    
    setIsSaving(true);
    try {
      await usersAPI.assignUsersToAdmin(assignUsersAdmin.id, selectedUsersToAssign);
      // Update local state
      setUsers(users.map(u => {
        if (u.id === assignUsersAdmin.id) {
          return { ...u, assigned_users: selectedUsersToAssign };
        }
        // Update managed_by for affected users
        if (selectedUsersToAssign.includes(u.id)) {
          return { ...u, managed_by: assignUsersAdmin.id };
        }
        if (u.managed_by === assignUsersAdmin.id && !selectedUsersToAssign.includes(u.id)) {
          return { ...u, managed_by: null };
        }
        return u;
      }));
      toast.success(`Users assigned to ${assignUsersAdmin.name}`, {
        description: `${selectedUsersToAssign.length} user(s) can now be managed by this Admin`
      });
      setAssignUsersDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to assign users: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Get users that can be assigned to admins
  // Super Admin can assign ANY user (except Super Admins and the target Admin themselves)
  const getAssignableUsers = () => {
    return users.filter(u => 
      u.role !== "Super Administrator" && // Cannot assign Super Admins
      u.id !== assignUsersAdmin?.id // Cannot assign the Admin to themselves
    );
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all fields");
      return;
    }

    // Check domain restriction
    if (isExternalEmail && !externalDomainApproved) {
      toast.error("External domain requires admin approval. Please check the approval box.");
      return;
    }

    setIsSaving(true);
    try {
      const created = await usersAPI.create(newUser, sendInvitationEmail);
      setUsers([...users, created]);
      
      // Store credentials to show in dialog
      setCreatedUserCredentials({
        name: newUser.name,
        email: newUser.email,
        emailSent: created.email_sent,
      });
      
      setIsAddDialogOpen(false);
      setCredentialsDialogOpen(true);
      
      // Reset form
      setNewUser({ 
        name: "", 
        email: "", 
        role: "User", 
        status: "Active",
        access_level: "standard" 
      });
      setExternalDomainApproved(false);
      setSendInvitationEmail(true);
    } catch (error) {
      toast.error(`Failed to create user: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!createdUserCredentials) return;
    const text = `DSG Transport Portal Access\n\nHello ${createdUserCredentials.name},\n\nYou've been invited to access the DSG Transport portal.\n\n🔗 Login: ${window.location.origin}\n\nClick "Continue with Google" and sign in with your company Google account (${createdUserCredentials.email}).\n\n- DSG Transport LLC`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Invitation copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("Invitation copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast.info("Copy the portal link: " + window.location.origin, { duration: 5000 });
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const shareViaWhatsApp = () => {
    if (!createdUserCredentials) return;
    const message = `🚚 *DSG Transport Portal Invitation*\n\nHello ${createdUserCredentials.name},\n\nYou've been invited to access the DSG Transport portal!\n\n🔗 *Login:* ${window.location.origin}\n\n✅ Click "Continue with Google" and sign in with your company Google account (${createdUserCredentials.email}).\n\n- DSG Transport LLC`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleEditUser = (user) => {
    setEditUser({ 
      ...user,
      role: user.role === "Administrator" ? "Administrator" : "User"
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editUser.name) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await usersAPI.update(editUser.id, {
        name: editUser.name,
        role: editUser.role,
        status: editUser.status,
        access_level: editUser.access_level,
      });
      setUsers(users.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)));
      setIsEditDialogOpen(false);
      setEditUser(null);
      toast.success("User updated successfully!");
    } catch (error) {
      toast.error(`Failed to update user: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      await usersAPI.delete(selectedUser.id);
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      toast.success(`${selectedUser.name} has been removed`);
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(`Failed to delete user: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspendUser = async (user) => {
    try {
      await usersAPI.suspend(user.id);
      setUsers(users.map((u) => u.id === user.id ? { ...u, status: "Suspended" } : u));
      toast.warning(`${user.name} has been suspended`, {
        description: "User can no longer access the portal.",
      });
    } catch (error) {
      toast.error(`Failed to suspend user: ${error.message}`);
    }
  };

  const handleReactivateUser = async (user) => {
    try {
      await usersAPI.reactivate(user.id);
      setUsers(users.map((u) => u.id === user.id ? { ...u, status: "Active" } : u));
      toast.success(`${user.name} has been reactivated`, {
        description: "User can now access the portal.",
      });
    } catch (error) {
      toast.error(`Failed to reactivate user: ${error.message}`);
    }
  };

  const handleResendInvitation = async (user) => {
    try {
      await usersAPI.resendInvitation(user.id);
      toast.success("Invitation resent!", {
        description: `A new invitation email has been sent to ${user.email}`,
      });
    } catch (error) {
      toast.error(`Failed to resend invitation: ${error.message}`);
    }
  };

  const handleChangeAccessLevel = async (user, newLevel) => {
    try {
      await usersAPI.update(user.id, { access_level: newLevel });
      setUsers(users.map((u) => u.id === user.id ? { ...u, access_level: newLevel } : u));
      const levelLabel = accessLevels.find((l) => l.value === newLevel)?.label;
      toast.success(`Access level updated`, {
        description: `${user.name} now has ${levelLabel} access.`,
      });
    } catch (error) {
      toast.error(`Failed to update access level: ${error.message}`);
    }
  };

  // Change user role (Super Admin only)
  const handleChangeRole = async (user, newRole) => {
    // Don't change if same role
    if (user.role === newRole) return;
    
    try {
      await usersAPI.changeRole(user.id, newRole);
      setUsers(users.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
      toast.success(`Role updated`, {
        description: `${user.name} is now ${newRole === "Administrator" ? "an Administrator" : "a User"}.`,
      });
    } catch (error) {
      toast.error(`Failed to change role: ${error.message}`);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Active: "active",
      Suspended: "destructive",
      Pending: "warning",
    };
    return variants[status] || "secondary";
  };

  const getAccessBadge = (level) => {
    const variants = {
      full: "admin",
      standard: "default",
      limited: "secondary",
      readonly: "outline",
    };
    return variants[level] || "secondary";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin 
              ? "Manage team members, access levels, and permissions" 
              : "Manage your assigned team members and their tool access"}
          </p>
        </div>

        {/* Only Super Admin can add new users */}
        {isSuperAdmin && (
          <Button variant="gradient" className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Info banner for Admins */}
      {isAdmin && !isSuperAdmin && (
        <div className="mb-6 p-4 rounded-lg bg-admin/5 border border-admin/20">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-admin" />
            <span className="font-medium text-admin">Admin View</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You can only see and manage users assigned to you by the Super Admin. 
            Contact Super Admin to get more users assigned.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-2 border-border/50">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{users.length}</p>
            <p className="text-sm text-muted-foreground">{isSuperAdmin ? "Total Users" : "My Users"}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-border/50">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-success">
              {users.filter((u) => u.status === "Active").length}
            </p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-border/50">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-warning">
              {users.filter((u) => u.status === "Pending").length}
            </p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-border/50">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-destructive">
              {users.filter((u) => u.status === "Suspended").length}
            </p>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* User Cards */}
      <div className="space-y-4 stagger-children">
        {filteredUsers.map((user) => (
          <Card
            key={user.id}
            className="border-2 border-border/50 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={`${
                        user.role === "Administrator"
                          ? "bg-gradient-primary text-primary-foreground"
                          : user.status === "Suspended"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-primary/20 text-primary"
                      } font-semibold`}
                    >
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground">{user.name}</h3>
                      {user.role === "Administrator" && (
                        <Shield className="h-4 w-4 text-admin" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Last active: {user.last_active || "Never"}</p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.role === "Super Administrator" ? "admin" : user.role === "Administrator" ? "admin" : "user"}>
                    {user.role === "Super Administrator" ? "Super Admin" : user.role === "Administrator" ? "Admin" : "User"}
                  </Badge>
                  <Badge variant={getStatusBadge(user.status)}>
                    {user.status}
                  </Badge>
                  <Badge variant={getAccessBadge(user.access_level)}>
                    {accessLevels.find((l) => l.value === user.access_level)?.label || "Standard"}
                  </Badge>
                  {/* Tool count badge */}
                  {user.allowed_tools && user.allowed_tools.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Wrench className="h-3 w-3" />
                      {user.allowed_tools.length} tools
                    </Badge>
                  )}
                  {/* Assigned users count for Admins */}
                  {user.role === "Administrator" && user.assigned_users && user.assigned_users.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {user.assigned_users.length} users
                    </Badge>
                  )}
                  {/* Managed by badge for Users */}
                  {user.managed_by && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Managed by: {users.find(u => u.id === user.managed_by)?.name || "Admin"}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Quick Tool Access Button - Super Admin can assign to Admin & User */}
                  {isSuperAdmin && (user.role === "User" || user.role === "Administrator") && user.email !== "info@dsgtransport.net" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 hidden sm:flex"
                      onClick={() => handleOpenToolAccess(user)}
                    >
                      <Package className="h-4 w-4" />
                      Tools
                    </Button>
                  )}

                  {/* Admin can assign tools to Users they manage */}
                  {!isSuperAdmin && isAdmin && user.role === "User" && canManageUser(user.id) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 hidden sm:flex"
                      onClick={() => handleOpenToolAccess(user)}
                    >
                      <Package className="h-4 w-4" />
                      Tools
                    </Button>
                  )}

                  {/* Assign Users Button for Admins (Super Admin only) */}
                  {isSuperAdmin && user.role === "Administrator" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 hidden sm:flex"
                      onClick={() => handleOpenAssignUsers(user)}
                    >
                      <Users className="h-4 w-4" />
                      Assign Users
                    </Button>
                  )}

                  {/* Role Change Dropdown - Super Admin only, not for primary Super Admin */}
                  {isSuperAdmin && user.email !== "info@dsgtransport.net" && (
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleChangeRole(user, value)}
                    >
                      <SelectTrigger className="w-28 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Administrator">Admin</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {/* Edit User - Only Super Admin can edit */}
                      {isSuperAdmin && (
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                      )}

                      {/* Change Role (Super Admin only) */}
                      {isSuperAdmin && user.email !== "info@dsgtransport.net" && (
                        <>
                          <DropdownMenuItem onClick={() => handleChangeRole(user, user.role === "Administrator" ? "User" : "Administrator")}>
                            <Shield className="mr-2 h-4 w-4" />
                            Make {user.role === "Administrator" ? "User" : "Admin"}
                          </DropdownMenuItem>
                        </>
                      )}

                      {/* Assign Users to Admin (Super Admin only) */}
                      {isSuperAdmin && user.role === "Administrator" && (
                        <DropdownMenuItem onClick={() => handleOpenAssignUsers(user)}>
                          <Users className="mr-2 h-4 w-4" />
                          Assign Users to Admin
                        </DropdownMenuItem>
                      )}

                      {/* Manage Tool Access - Super Admin can assign to Admin & User */}
                      {isSuperAdmin && (user.role === "User" || user.role === "Administrator") && user.email !== "info@dsgtransport.net" && (
                        <DropdownMenuItem onClick={() => handleOpenToolAccess(user)}>
                          <Package className="mr-2 h-4 w-4" />
                          Manage Tool Access
                        </DropdownMenuItem>
                      )}

                      {/* Admin can manage tools for Users assigned to them */}
                      {!isSuperAdmin && isAdmin && user.role === "User" && canManageUser(user.id) && (
                        <DropdownMenuItem onClick={() => handleOpenToolAccess(user)}>
                          <Package className="mr-2 h-4 w-4" />
                          Manage Tool Access
                        </DropdownMenuItem>
                      )}

                      {user.status === "Pending" && (
                        <DropdownMenuItem onClick={() => handleResendInvitation(user)}>
                          <Mail className="mr-2 h-4 w-4" />
                          Resend Invitation
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Suspend - Only for Users the current user can manage */}
                      {user.status === "Active" && user.role === "User" && canManageUser(user.id) && (
                        <DropdownMenuItem
                          onClick={() => handleSuspendUser(user)}
                          className="text-warning focus:text-warning"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Suspend User
                        </DropdownMenuItem>
                      )}

                      {/* Reactivate - Only for Users the current user can manage */}
                      {user.status === "Suspended" && canManageUser(user.id) && (
                        <DropdownMenuItem
                          onClick={() => handleReactivateUser(user)}
                          className="text-success focus:text-success"
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Reactivate User
                        </DropdownMenuItem>
                      )}

                      {/* Only Super Admin can delete users */}
                      {isSuperAdmin && user.role !== "Administrator" && user.role !== "Super Administrator" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No users found matching your search.</p>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setExternalDomainApproved(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for the DSG Transport portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={newUser.email}
                onChange={(e) => {
                  setNewUser({ ...newUser, email: e.target.value });
                  setExternalDomainApproved(false); // Reset approval when email changes
                }}
                className={isExternalEmail ? "border-warning" : ""}
              />
              {/* Domain restriction warning */}
              {isExternalEmail && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 space-y-2">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">External Domain Detected</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This email is not from an approved DSG domain (@dsgtransport.net, @teamdsgtransport.com, @dsgtransport.com).
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={externalDomainApproved}
                      onChange={(e) => setExternalDomainApproved(e.target.checked)}
                      className="rounded border-warning text-warning focus:ring-warning"
                    />
                    <span className="text-sm">I approve this external user to access the portal</span>
                  </label>
                </div>
              )}
              {!isExternalEmail && newUser.email && newUser.email.includes("@") && (
                <p className="text-xs text-success flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Approved company domain
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrator">Admin</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="access">Access Level</Label>
                <Select
                  value={newUser.access_level}
                  onValueChange={(value) => setNewUser({ ...newUser, access_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Send Email Checkbox */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInvitationEmail}
                  onChange={(e) => setSendInvitationEmail(e.target.checked)}
                  className="rounded border-primary text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <span className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Send invitation email
                  </span>
                  <p className="text-xs text-muted-foreground">
                    User will receive an invitation with portal link to login via Google SSO
                  </p>
                </div>
              </label>
            </div>

            {/* Google SSO Info */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                User will login using their company Google account
              </p>
            </div>

            <Button 
              variant="gradient" 
              className="w-full mt-4" 
              onClick={handleAddUser}
              disabled={isSaving || (isExternalEmail && !externalDomainApproved)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {sendInvitationEmail ? "Create & Send Email" : "Create User"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Share Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) {
          setCopied(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" />
              User Created Successfully!
            </DialogTitle>
            <DialogDescription>
              {createdUserCredentials?.emailSent 
                ? `Invitation email sent to ${createdUserCredentials?.email}`
                : `Share these login credentials with ${createdUserCredentials?.name}`
              }
            </DialogDescription>
          </DialogHeader>
          {createdUserCredentials && (
            <div className="space-y-4 py-4">
              {/* Email Status Banner */}
              {createdUserCredentials.emailSent ? (
                <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-success">Invitation Email Sent!</p>
                    <p className="text-xs text-muted-foreground">
                      User will receive portal link at {createdUserCredentials.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Email Not Sent</p>
                    <p className="text-xs text-muted-foreground">
                      Please share invitation manually via WhatsApp or copy
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="font-medium">{createdUserCredentials.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="font-medium">{createdUserCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Login Method:</span>
                  <span className="font-medium flex items-center gap-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google SSO
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Portal:</span>
                  <span className="font-mono text-sm text-primary">{window.location.origin}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="gradient"
                  className="w-full gap-2"
                  onClick={shareViaWhatsApp}
                >
                  <MessageCircle className="h-4 w-4" />
                  Share via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={copyCredentials}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Invitation
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                {createdUserCredentials.emailSent 
                  ? "User will click the link and sign in with their Google account"
                  : "Share the invitation so user can sign in with their Google account"
                }
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Full Name</Label>
                <Input
                  id="editName"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email Address</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editUser.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editUser.role}
                    onValueChange={(value) => setEditUser({ ...editUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrator">Admin</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editUser.status}
                    onValueChange={(value) => setEditUser({ ...editUser, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select
                  value={editUser.access_level}
                  onValueChange={(value) => setEditUser({ ...editUser, access_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div>
                          <p className="font-medium">{level.label}</p>
                          <p className="text-xs text-muted-foreground">{level.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  variant="gradient" 
                  className="flex-1" 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
              All user data and access will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
            >
              {isSaving ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tool Access Dialog */}
      <Dialog open={toolAccessDialogOpen} onOpenChange={setToolAccessDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Manage Tool Access
            </DialogTitle>
            <DialogDescription>
              Select which tools {toolAccessUser?.name} can access on the dashboard
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* User Info */}
            <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {toolAccessUser?.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{toolAccessUser?.name}</p>
                <p className="text-sm text-muted-foreground">{toolAccessUser?.email}</p>
              </div>
            </div>

            {/* Select All / Clear */}
            {(() => {
              const assignableTools = getAssignableTools();
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {isSuperAdmin ? `All Tools (${assignableTools.length})` : `Your Assignable Tools (${assignableTools.length})`}
                    </Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSelectAllTools}
                    >
                      {selectedTools.length >= assignableTools.length ? "Clear All" : "Select All"}
                    </Button>
                  </div>

                  {/* Info for Admin */}
                  {isAdmin && !isSuperAdmin && (
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      You can only assign tools that have been assigned to you by Super Admin.
                    </p>
                  )}

                  {/* Tools List */}
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {assignableTools.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No tools available to assign. Contact Super Admin.
                        </p>
                      ) : (
                        assignableTools.map((tool) => (
                          <div
                            key={tool.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedTools.includes(tool.id) 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:bg-muted/50"
                            }`}
                            onClick={() => handleToggleTool(tool.id)}
                          >
                            <Checkbox 
                              checked={selectedTools.includes(tool.id)}
                              onCheckedChange={() => handleToggleTool(tool.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{tool.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {tool.category} • {tool.description?.substring(0, 50)}...
                              </p>
                            </div>
                            {selectedTools.includes(tool.id) && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Summary */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm">
                      <span className="font-semibold text-primary">{selectedTools.length}</span> tool(s) will be accessible
                    </p>
                    {selectedTools.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        User will not see any tools on dashboard
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setToolAccessDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSaveToolAccess}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Access
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Users to Admin Dialog (Super Admin only) */}
      <Dialog open={assignUsersDialogOpen} onOpenChange={setAssignUsersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Assign Users to Admin
            </DialogTitle>
            <DialogDescription>
              Select which users <span className="font-semibold">{assignUsersAdmin?.name}</span> can manage
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Admin Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-admin/5 border border-admin/20">
              <div className="w-10 h-10 rounded-full bg-admin/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-admin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{assignUsersAdmin?.name}</p>
                <p className="text-sm text-muted-foreground">{assignUsersAdmin?.email}</p>
              </div>
              <Badge variant="admin">Administrator</Badge>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-10"
                value={userAssignSearch || ""}
                onChange={(e) => setUserAssignSearch(e.target.value)}
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUsersToAssign(getAssignableUsers().map(u => u.id))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUsersToAssign([])}
              >
                Clear All
              </Button>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium mb-2">
                Available Users ({getAssignableUsers().filter(u => 
                  !userAssignSearch || 
                  u.name.toLowerCase().includes(userAssignSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(userAssignSearch.toLowerCase())
                ).length})
              </p>
              <ScrollArea className="h-[280px] border rounded-lg p-2">
                <div className="space-y-2">
                  {getAssignableUsers().filter(u => 
                    !userAssignSearch || 
                    u.name.toLowerCase().includes(userAssignSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userAssignSearch.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {userAssignSearch ? "No users found matching your search" : "No users available to assign"}
                    </p>
                  ) : (
                    getAssignableUsers()
                      .filter(u => 
                        !userAssignSearch || 
                        u.name.toLowerCase().includes(userAssignSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userAssignSearch.toLowerCase())
                      )
                      .map(user => {
                        const currentManager = users.find(u => u.id === user.managed_by);
                        const isAssignedToOther = user.managed_by && user.managed_by !== assignUsersAdmin?.id;
                        
                        return (
                          <div
                            key={user.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              selectedUsersToAssign.includes(user.id)
                                ? "bg-primary/10 border-2 border-primary"
                                : "bg-muted/30 border-2 border-transparent hover:bg-muted/50"
                            }`}
                            onClick={() => handleToggleUserAssignment(user.id)}
                          >
                            <Checkbox
                              checked={selectedUsersToAssign.includes(user.id)}
                              onCheckedChange={() => handleToggleUserAssignment(user.id)}
                            />
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {user.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              {isAssignedToOther && (
                                <p className="text-xs text-warning flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  Currently managed by: {currentManager?.name || "Another Admin"}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={user.role === "Administrator" ? "admin" : "user"}>
                                {user.role === "Administrator" ? "Admin" : "User"}
                              </Badge>
                              <Badge variant={user.status === "Active" ? "success" : "warning"}>
                                {user.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Summary */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                <span className="font-semibold text-primary">{selectedUsersToAssign.length}</span> user(s) will be managed by this Admin
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Admin can suspend/activate and assign tools (from their allowed tools) to these users
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAssignUsersDialogOpen(false);
                  setUserAssignSearch("");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSaveUserAssignment}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Assign Users
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
