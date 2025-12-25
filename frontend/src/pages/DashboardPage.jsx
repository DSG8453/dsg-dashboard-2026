import { useState, useEffect } from "react";
import { HeaderCard } from "@/components/dashboard/HeaderCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { ToolCard } from "@/components/dashboard/ToolCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { toolsAPI, usersAPI } from "@/services/api";
import { toast } from "sonner";
import {
  Wrench,
  Users,
  Activity,
  Shield,
  Monitor,
  Package,
  FileCheck,
  Cloud,
  Truck,
  Database,
  Globe,
  CreditCard,
  BarChart3,
  Mail,
  Calendar,
  FolderOpen,
  Key,
  Plus,
  Loader2,
} from "lucide-react";

const iconMap = {
  Shield, Monitor, Truck, Package, FileCheck, Cloud, Wrench, Database,
  Globe, CreditCard, BarChart3, Mail, Calendar, FolderOpen, Key,
};

const iconOptions = [
  { name: "Shield", icon: Shield },
  { name: "Monitor", icon: Monitor },
  { name: "Truck", icon: Truck },
  { name: "Package", icon: Package },
  { name: "FileCheck", icon: FileCheck },
  { name: "Cloud", icon: Cloud },
  { name: "Wrench", icon: Wrench },
  { name: "Database", icon: Database },
  { name: "Globe", icon: Globe },
  { name: "CreditCard", icon: CreditCard },
  { name: "BarChart3", icon: BarChart3 },
  { name: "Mail", icon: Mail },
  { name: "Calendar", icon: Calendar },
  { name: "FolderOpen", icon: FolderOpen },
];

const categoryOptions = [
  "Security",
  "Support",
  "TMS",
  "Compliance",
  "Freight",
  "Operations",
  "Finance",
  "Communication",
  "Analytics",
  "Other",
];

export const DashboardPage = ({ currentUser }) => {
  const { user, addToolCredential, dashboardRefreshKey } = useAuth();
  const [tools, setTools] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addCredentials, setAddCredentials] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    category: "",
    description: "",
    url: "",
    icon: "Globe",
  });
  const [newCredentials, setNewCredentials] = useState({
    username: "",
    password: "",
    login_url: "",
    notes: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isSuperAdmin = user?.role === "Super Administrator";
  const isAdmin = user?.role === "Administrator";
  const isRegularUser = user?.role === "User";

  // Fetch tools and users count on mount or when dashboardRefreshKey changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const toolsData = await toolsAPI.getAll();
        
        // Map icon string to actual component
        let toolsWithIcons = toolsData.map(tool => ({
          ...tool,
          icon: iconMap[tool.icon] || Globe,
          iconName: tool.icon,
        }));

        // Super Admin sees ALL tools
        // Admin and User only see ASSIGNED tools
        if (!isSuperAdmin && user) {
          try {
            console.log("Fetching tool access for user:", user.id, user.role);
            const accessData = await usersAPI.getToolAccess(user.id);
            const allowedToolIds = accessData.allowed_tools || [];
            console.log("Allowed tool IDs:", allowedToolIds);
            
            // Filter to only show assigned tools - even if 0 tools assigned
            toolsWithIcons = toolsWithIcons.filter(tool => allowedToolIds.includes(tool.id));
            console.log("Filtered tools count:", toolsWithIcons.length);
          } catch (error) {
            // If can't fetch access, show no tools for safety
            console.error("Could not fetch tool access:", error);
            toolsWithIcons = [];
          }
        }

        setTools(toolsWithIcons);

        // Get users count only for Super Admin
        if (isSuperAdmin) {
          try {
            const usersData = await usersAPI.getAll();
            setUsersCount(usersData.length);
          } catch {
            setUsersCount(0);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tools:", error);
        toast.error("Failed to load tools");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, isSuperAdmin, dashboardRefreshKey]); // Added dashboardRefreshKey as dependency

  const stats = [
    { value: String(tools.length), label: "Active Tools", variant: "blue", icon: Wrench },
    { value: String(usersCount || "—"), label: "Total Users", variant: "indigo", icon: Users },
    { value: "Operational", label: "System Status", variant: "green", icon: Activity },
  ];

  const handleAddTool = () => {
    setIsAddDialogOpen(true);
  };

  const handleSubmitTool = async () => {
    if (!newTool.name || !newTool.category || !newTool.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      // Create tool via API with credentials
      const toolData = {
        name: newTool.name,
        category: newTool.category,
        description: newTool.description,
        url: newTool.url || "#",
        icon: newTool.icon,
        credentials: (addCredentials && (newCredentials.username || newCredentials.password)) ? {
          username: newCredentials.username,
          password: newCredentials.password,
          login_url: newCredentials.login_url,
          notes: newCredentials.notes
        } : null
      };

      const createdTool = await toolsAPI.create(toolData);

      // Add to local state with icon component
      const toolWithIcon = {
        ...createdTool,
        icon: iconMap[createdTool.icon] || Globe,
        iconName: createdTool.icon,
      };

      toast.success(`${createdTool.name} added successfully!`, {
        description: addCredentials ? "Tool and credentials saved securely." : `New tool added to ${createdTool.category} category.`,
      });

      setTools([...tools, toolWithIcon]);

      // Reset form
      setNewTool({
        name: "",
        category: "",
        description: "",
        url: "",
        icon: "Globe",
      });
      setNewCredentials({ username: "", password: "", login_url: "", notes: "" });
      setAddCredentials(false);
      setShowNewPassword(false);
      setIsAddDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to add tool: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTool = async (toolId) => {
    setTools(tools.filter((t) => t.id !== toolId));
  };

  // Refresh tools data
  const handleToolUpdate = async () => {
    try {
      const toolsData = await toolsAPI.getAll();
      let toolsWithIcons = toolsData.map(tool => ({
        ...tool,
        icon: iconMap[tool.icon] || Globe,
        iconName: tool.icon,
      }));

      if (!isSuperAdmin && user) {
        try {
          const accessData = await usersAPI.getToolAccess(user.id);
          const allowedToolIds = accessData.allowed_tools || [];
          // Always filter - even if 0 tools assigned
          toolsWithIcons = toolsWithIcons.filter(tool => allowedToolIds.includes(tool.id));
        } catch {
          toolsWithIcons = [];
        }
      }

      setTools(toolsWithIcons);
    } catch (error) {
      console.error("Failed to refresh tools:", error);
    }
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
      <HeaderCard currentUser={currentUser} onAddTool={isSuperAdmin ? handleAddTool : null} />

      {/* Stats Grid - Only for Super Admin */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 stagger-children">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      )}

      {/* Tools Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {isSuperAdmin ? "All Company Tools" : "My Assigned Tools"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger-children">
          {tools.map((tool) => (
            <ToolCard 
              key={tool.id} 
              tool={tool} 
              onDelete={isSuperAdmin ? handleDeleteTool : null}
              onUpdate={handleToolUpdate}
            />
          ))}
          {tools.length === 0 && !isSuperAdmin && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No tools assigned yet. Contact your administrator.
            </div>
          )}
        </div>
      </div>

      {/* Add Tool Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add New Tool
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="toolName">Tool Name *</Label>
              <Input
                id="toolName"
                placeholder="e.g., Slack, Trello, QuickBooks"
                value={newTool.name}
                onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={newTool.category}
                  onValueChange={(value) => setNewTool({ ...newTool, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select
                  value={newTool.icon}
                  onValueChange={(value) => setNewTool({ ...newTool, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((opt) => (
                      <SelectItem key={opt.name} value={opt.name}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Brief description of what this tool does..."
                value={newTool.description}
                onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Tool URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={newTool.url}
                onChange={(e) => setNewTool({ ...newTool, url: e.target.value })}
              />
            </div>

            {/* Super Admin: Add Credentials Section */}
            {isSuperAdmin && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        Add Login Credentials
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Store login credentials securely (Super Admin only)
                      </p>
                    </div>
                    <Switch
                      checked={addCredentials}
                      onCheckedChange={setAddCredentials}
                    />
                  </div>

                  {addCredentials && (
                    <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="space-y-2">
                        <Label>Login URL</Label>
                        <Input
                          placeholder="https://login.example.com"
                          value={newCredentials.login_url}
                          onChange={(e) =>
                            setNewCredentials({ ...newCredentials, login_url: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Username / Email</Label>
                          <Input
                            placeholder="Username or email"
                            value={newCredentials.username}
                            onChange={(e) =>
                              setNewCredentials({ ...newCredentials, username: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              placeholder="••••••••"
                              value={newCredentials.password}
                              onChange={(e) =>
                                setNewCredentials({ ...newCredentials, password: e.target.value })
                              }
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              className="absolute right-1 top-1/2 -translate-y-1/2"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <Key className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          placeholder="Additional notes (e.g., 2FA setup instructions)"
                          value={newCredentials.notes}
                          onChange={(e) =>
                            setNewCredentials({ ...newCredentials, notes: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setAddCredentials(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSubmitTool}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  addCredentials ? "Add Tool & Credentials" : "Add Tool"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
