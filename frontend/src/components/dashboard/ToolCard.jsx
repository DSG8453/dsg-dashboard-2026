/* Tool Card Component - Backend-Only Authentication */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { toolsAPI } from "@/services/api";
import { 
  MoreVertical, 
  Trash2, 
  Key, 
  KeyRound, 
  Edit, 
  Eye, 
  EyeOff,
  Loader2,
  Lock,
  Globe,
  Link,
  User,
  FileText,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

// Icon options for tools
const iconOptions = [
  "Globe", "Mail", "Calendar", "FileText", "Database", "Cloud", 
  "Shield", "Users", "Settings", "BarChart", "Truck", "Package",
  "CreditCard", "Phone", "MessageSquare", "Folder"
];

// Category options
const categoryOptions = [
  "Communication", "Productivity", "Analytics", "Finance", 
  "Operations", "HR", "IT", "Marketing", "Sales", "Other"
];

export const ToolCard = ({ tool, onDelete, onUpdate }) => {
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAccessingTool, setIsAccessingTool] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    description: "",
    icon: "",
    url: "",
    credentials: {
      username: "",
      password: "",
      login_url: "",
      username_field: "username",
      password_field: "password",
      notes: ""
    }
  });

  // Check user role
  const isSuperAdmin = user?.role === "Super Administrator";
  const hasCredentials = tool.has_credentials || (tool.credentials && (tool.credentials.username || tool.credentials.password));

  // Main access handler - Uses backend gateway for secure credential access
  const handleToolAccess = async () => {
    setIsAccessingTool(true);
    
    try {
      toast.info(`Opening ${tool.name}...`, {
        description: "Preparing secure access",
        icon: <Shield className="h-4 w-4" />,
      });
      
      // Use the backend gateway - credentials are fetched server-side from Secret Manager
      const response = await toolsAPI.startGatewaySession(tool.id);
      
      if (response.gateway_url) {
        // Open the secure gateway page - credentials handled entirely by backend
        const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
        const fullUrl = backendUrl + response.gateway_url;
        window.open(fullUrl, "_blank", "noopener,noreferrer");
        
        toast.success(`${tool.name} opened!`, {
          description: "Secure access gateway ready",
          icon: <Shield className="h-4 w-4" />,
        });
      } else if (response.direct_url || tool.url) {
        // No credentials configured - open tool directly
        const toolUrl = response.direct_url || tool.url;
        window.open(toolUrl, '_blank', 'noopener');
        
        toast.info(`${tool.name} opened`, {
          description: "Please login manually",
        });
      } else {
        throw new Error("Tool URL not configured");
      }
    } catch (error) {
      console.error("Tool access failed:", error);
      
      // Fallback - just open the tool URL directly
      const toolUrl = tool.credentials?.login_url || tool.url;
      if (toolUrl) {
        window.open(toolUrl, '_blank', 'noopener');
        toast.info(`${tool.name} opened`, {
          description: "Please login manually",
        });
      } else {
        toast.error("Failed to open tool", {
          description: error.message || "Please contact your administrator",
        });
      }
    } finally {
      setIsAccessingTool(false);
    }
  };

  // Open edit dialog
  const handleOpenEdit = () => {
    setEditForm({
      name: tool.name || "",
      category: tool.category || "",
      description: tool.description || "",
      icon: tool.iconName || tool.icon || "Globe",
      url: tool.url || "",
      credentials: {
        username: tool.credentials?.username || "",
        password: tool.credentials?.password || "",
        login_url: tool.credentials?.login_url || "",
        username_field: tool.credentials?.username_field || "username",
        password_field: tool.credentials?.password_field || "password",
        notes: tool.credentials?.notes || ""
      }
    });
    setShowPassword(false);
    setEditDialogOpen(true);
  };

  // Save tool updates
  const handleSave = async () => {
    if (!editForm.name || !editForm.category) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        name: editForm.name,
        category: editForm.category,
        description: editForm.description,
        icon: editForm.icon,
        url: editForm.url,
        credentials: editForm.credentials.username || editForm.credentials.password ? {
          username: editForm.credentials.username,
          password: editForm.credentials.password,
          login_url: editForm.credentials.login_url,
          username_field: editForm.credentials.username_field || "username",
          password_field: editForm.credentials.password_field || "password",
          notes: editForm.credentials.notes
        } : null
      };

      await toolsAPI.update(tool.id, updateData);
      toast.success("Tool updated successfully");
      setEditDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(`Failed to update tool: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete tool
  const handleDelete = async () => {
    try {
      await toolsAPI.delete(tool.id);
      toast.success("Tool deleted successfully");
      setDeleteDialogOpen(false);
      if (onDelete) onDelete(tool.id);
    } catch (error) {
      toast.error(`Failed to delete tool: ${error.message}`);
    }
  };

  return (
    <>
      <Card className="border-2 border-border/50 shadow-card hover-lift group">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-start gap-4 mb-4">
            <div className="icon-gradient p-3 rounded-xl text-primary-foreground shadow-md group-hover:shadow-glow transition-shadow duration-300">
              <tool.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground truncate">
                {tool.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">{tool.category}</Badge>
                {/* Only show credentials badge to Super Admin */}
                {isSuperAdmin && hasCredentials && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="success" className="gap-1">
                          <KeyRound className="h-3 w-3" />
                          Saved
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Login credentials saved</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            {/* Super Admin only dropdown menu */}
            {isSuperAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Tool
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenEdit}>
                    <Key className="mr-2 h-4 w-4" />
                    Manage Credentials
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Tool
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
            {tool.description}
          </p>

          <div className="flex gap-2">
            {/* Secure Tool Access - Backend Only */}
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              onClick={handleToolAccess}
              disabled={isAccessingTool}
            >
              {isAccessingTool ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Open Tool
                </>
              )}
            </Button>
            
            {/* Edit button - Super Admin only */}
            {isSuperAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleOpenEdit}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Tool & Credentials</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Tool Dialog - Super Admin only */}
      {isSuperAdmin && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Edit Tool
              </DialogTitle>
              <DialogDescription>
                Update tool details and login credentials
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Tool Information
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      placeholder="Tool name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) => setEditForm({...editForm, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    placeholder="Brief description of the tool"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <Select
                      value={editForm.icon}
                      onValueChange={(value) => setEditForm({...editForm, icon: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {iconOptions.map(icon => (
                          <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tool URL</Label>
                    <Input
                      value={editForm.url}
                      onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Credentials Section */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Login Credentials
                  <Badge variant="outline" className="text-xs">Super Admin Only</Badge>
                </h4>
                
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                  <p className="text-warning font-medium">⚠️ Secure Storage</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Credentials are stored in Google Secret Manager and never exposed to the frontend.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link className="h-3 w-3" />
                    Login URL
                  </Label>
                  <Input
                    value={editForm.credentials.login_url}
                    onChange={(e) => {
                      const url = e.target.value;
                      // Auto-detect form field names based on URL
                      let username_field = editForm.credentials.username_field || "username";
                      let password_field = editForm.credentials.password_field || "password";
                      
                      // Known site mappings for auto-fill
                      if (url.includes('rmissecure.com')) {
                        username_field = "ctl00$ContentPlaceHolderMain$txtUserName";
                        password_field = "ctl00$ContentPlaceHolderMain$txtPassword";
                      } else if (url.includes('zoho.com')) {
                        username_field = "LOGIN_ID";
                        password_field = "PASSWORD";
                      } else if (url.includes('microsoft.com') || url.includes('office.com')) {
                        username_field = "loginfmt";
                        password_field = "passwd";
                      } else if (url.includes('google.com')) {
                        username_field = "identifier";
                        password_field = "password";
                      } else if (url.includes('dat.com') || url.includes('truckstop.com')) {
                        username_field = "email";
                        password_field = "password";
                      }
                      
                      setEditForm({
                        ...editForm, 
                        credentials: {
                          ...editForm.credentials, 
                          login_url: url,
                          username_field: username_field,
                          password_field: password_field
                        }
                      });
                    }}
                    placeholder="https://login.example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Username
                    </Label>
                    <Input
                      value={editForm.credentials.username}
                      onChange={(e) => setEditForm({
                        ...editForm, 
                        credentials: {...editForm.credentials, username: e.target.value}
                      })}
                      placeholder="Username or email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="h-3 w-3" />
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={editForm.credentials.password}
                        onChange={(e) => setEditForm({
                          ...editForm, 
                          credentials: {...editForm.credentials, password: e.target.value}
                        })}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Advanced Form Field Configuration - Auto-filled based on URL */}
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    Form Field Names (auto-detected)
                    <span className="text-green-500 text-[10px]">✓ Auto-filled</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Username Field</Label>
                      <Input
                        value={editForm.credentials.username_field || "username"}
                        onChange={(e) => setEditForm({
                          ...editForm, 
                          credentials: {...editForm.credentials, username_field: e.target.value}
                        })}
                        placeholder="username"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Password Field</Label>
                      <Input
                        value={editForm.credentials.password_field || "password"}
                        onChange={(e) => setEditForm({
                          ...editForm, 
                          credentials: {...editForm.credentials, password_field: e.target.value}
                        })}
                        placeholder="password"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Auto-detected from URL. Edit only if auto-login does not work.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Notes
                  </Label>
                  <Textarea
                    value={editForm.credentials.notes}
                    onChange={(e) => setEditForm({
                      ...editForm, 
                      credentials: {...editForm.credentials, notes: e.target.value}
                    })}
                    placeholder="Additional notes (e.g., 2FA instructions)"
                    rows={2}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={handleSave}
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
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{tool.name}</strong>? This will also delete all saved credentials for this tool. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
