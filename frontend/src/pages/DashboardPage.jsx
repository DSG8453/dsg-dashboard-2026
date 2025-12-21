import { useState } from "react";
import { HeaderCard } from "@/components/dashboard/HeaderCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { ToolCard } from "@/components/dashboard/ToolCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";

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

const initialTools = [
  {
    id: 1,
    name: "Bitwarden",
    category: "Security",
    description: "Password manager for secure credential storage and sharing across the team.",
    icon: Shield,
    iconName: "Shield",
    url: "https://vault.bitwarden.com",
  },
  {
    id: 2,
    name: "Zoho Assist",
    category: "Support",
    description: "Remote desktop support and control panel for IT assistance and troubleshooting.",
    icon: Monitor,
    iconName: "Monitor",
    url: "https://assist.zoho.com",
  },
  {
    id: 3,
    name: "Ascend TMS",
    category: "TMS",
    description: "Transportation management system for fleet operations and logistics tracking.",
    icon: Truck,
    iconName: "Truck",
    url: "#",
  },
  {
    id: 4,
    name: "RMIS",
    category: "Compliance",
    description: "Risk management and compliance tracking system for regulatory requirements.",
    icon: FileCheck,
    iconName: "FileCheck",
    url: "#",
  },
  {
    id: 5,
    name: "DAT Load Board",
    category: "Freight",
    description: "Load board platform for finding and posting freight opportunities.",
    icon: Package,
    iconName: "Package",
    url: "#",
  },
  {
    id: 6,
    name: "Truckstop",
    category: "Freight",
    description: "Freight matching and load board services for trucking companies.",
    icon: Cloud,
    iconName: "Cloud",
    url: "#",
  },
  {
    id: 7,
    name: "Fleet Maintenance",
    category: "Operations",
    description: "Vehicle maintenance tracking and scheduling system for fleet management.",
    icon: Wrench,
    iconName: "Wrench",
    url: "#",
  },
  {
    id: 8,
    name: "Fuel Cards Portal",
    category: "Finance",
    description: "Fuel card management and expense tracking for fleet operations.",
    icon: Database,
    iconName: "Database",
    url: "#",
  },
];

export const DashboardPage = ({ currentUser }) => {
  const [tools, setTools] = useState(initialTools);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    category: "",
    description: "",
    url: "",
    iconName: "Globe",
  });

  const stats = [
    { value: String(tools.length), label: "Active Tools", variant: "blue", icon: Wrench },
    { value: "12", label: "Total Users", variant: "indigo", icon: Users },
    { value: "Operational", label: "System Status", variant: "green", icon: Activity },
  ];

  const handleAddTool = () => {
    setIsAddDialogOpen(true);
  };

  const handleSubmitTool = () => {
    if (!newTool.name || !newTool.category || !newTool.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    const selectedIcon = iconOptions.find((i) => i.name === newTool.iconName);
    
    const tool = {
      id: tools.length + 1,
      name: newTool.name,
      category: newTool.category,
      description: newTool.description,
      url: newTool.url || "#",
      icon: selectedIcon?.icon || Globe,
      iconName: newTool.iconName,
    };

    setTools([...tools, tool]);
    setNewTool({
      name: "",
      category: "",
      description: "",
      url: "",
      iconName: "Globe",
    });
    setIsAddDialogOpen(false);
    toast.success(`${tool.name} added successfully!`, {
      description: `New tool added to ${tool.category} category.`,
    });
  };

  const handleDeleteTool = (toolId) => {
    setTools(tools.filter((t) => t.id !== toolId));
    toast.success("Tool removed successfully!");
  };

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
            <ToolCard key={tool.id} tool={tool} onDelete={handleDeleteTool} />
          ))}
        </div>
      </div>

      {/* Add Tool Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Tool</DialogTitle>
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
                value={newTool.iconName}
                onValueChange={(value) => setNewTool({ ...newTool, iconName: value })}
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

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSubmitTool}
              >
                Add Tool
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
