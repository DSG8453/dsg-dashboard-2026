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
  const { user, addToolCredential } = useAuth();
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
  const [credentials, setCredentials] = useState({
    label: "",
    username: "",
    password: "",
  });

  const isAdmin = user?.role === "Administrator";

  // Fetch tools and users count on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const toolsData = await toolsAPI.getAll();
        // Map icon string to actual component
        const toolsWithIcons = toolsData.map(tool => ({
          ...tool,
          icon: iconMap[tool.icon] || Globe,
          iconName: tool.icon,
        }));
        setTools(toolsWithIcons);

        // Get users count if admin
        if (user?.role === "Administrator") {
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
  }, [user]);

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

    if (addCredentials && (!credentials.username || !credentials.password)) {
      toast.error("Please fill in credential username and password");
      return;
    }

    setIsSaving(true);

    try {
      // Create tool via API
      const createdTool = await toolsAPI.create({
        name: newTool.name,
        category: newTool.category,
        description: newTool.description,
        url: newTool.url || "#",
        icon: newTool.icon,
      });

      // Add to local state with icon component
      const toolWithIcon = {
        ...createdTool,
        icon: iconMap[createdTool.icon] || Globe,
        iconName: createdTool.icon,
      };

      // Add credentials if provided
      if (addCredentials && credentials.username && credentials.password) {
        try {
          await addToolCredential(
            createdTool.id,
            credentials.username,
            credentials.password,
            credentials.label || "Default Account"
          );
          toolWithIcon.credentials_count = 1;
          toast.success(`${createdTool.name} added with credentials!`, {
            description: `Tool and login credentials saved successfully.`,
          });
        } catch (credError) {
          toast.warning(`Tool added but credentials failed: ${credError.message}`);
        }
      } else {
        toast.success(`${createdTool.name} added successfully!`, {
          description: `New tool added to ${createdTool.category} category.`,
        });
      }

      setTools([...tools, toolWithIcon]);

      // Reset form
      setNewTool({
        name: "",
        category: "",
        description: "",
        url: "",
        icon: "Globe",
      });
      setCredentials({ label: "", username: "", password: "" });
      setAddCredentials(false);
      setIsAddDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to add tool: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTool = async (toolId) => {
    try {
      await toolsAPI.delete(toolId);
      setTools(tools.filter((t) => t.id !== toolId));
      toast.success("Tool removed successfully!");
    } catch (error) {
      toast.error(`Failed to delete tool: ${error.message}`);
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
      <HeaderCard currentUser={currentUser} onAddTool={handleAddTool} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 stagger-children">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Tools Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-6">All Company Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger-children">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onDelete={isAdmin ? handleDeleteTool : null} />
          ))}
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

            {/* Admin: Add Credentials Section */}
            {isAdmin && (
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
                        Save login credentials for this tool
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
                        <Label htmlFor="credLabel">Account Label</Label>
                        <Input
                          id="credLabel"
                          placeholder="e.g., Admin Account, Work Account"
                          value={credentials.label}
                          onChange={(e) =>
                            setCredentials({ ...credentials, label: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="credUsername">Username / Email *</Label>
                        <Input
                          id="credUsername"
                          placeholder="Enter username or email"
                          value={credentials.username}
                          onChange={(e) =>
                            setCredentials({ ...credentials, username: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="credPassword">Password *</Label>
                        <Input
                          id="credPassword"
                          type="password"
                          placeholder="Enter password"
                          value={credentials.password}
                          onChange={(e) =>
                            setCredentials({ ...credentials, password: e.target.value })
                          }
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
