import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  RefreshCw,
  LogIn,
  LogOut,
  Eye,
  Settings,
  UserPlus,
  Key,
  Loader2,
  Ban,
  Package,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { activityLogsAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const ActionIcon = ({ type, action }) => {
  // Map specific actions to icons
  if (action?.toLowerCase().includes("suspend")) return Ban;
  if (action?.toLowerCase().includes("assigned") || action?.toLowerCase().includes("tool")) return Package;
  if (action?.toLowerCase().includes("login")) return LogIn;
  if (action?.toLowerCase().includes("logout")) return LogOut;
  
  const icons = {
    access: Eye,
    auth: LogIn,
    admin: UserPlus,
    security: Key,
    settings: Settings,
  };
  const Icon = icons[type] || Eye;
  return Icon;
};

export const ActivityLogsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activityLogs, setActivityLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is Super Admin - redirect if not
  useEffect(() => {
    if (user && user.role !== "Super Administrator") {
      toast.error("Access denied. Super Admin only.");
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch activity logs
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await activityLogsAPI.getAll(100, filterType);
      setActivityLogs(logs);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
      toast.error("Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType]);

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tool?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleRefresh = () => {
    fetchLogs();
    toast.success("Activity logs refreshed!");
  };

  const handleExport = () => {
    // Export as CSV
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const csvContent = [
      ["User", "Action", "Target", "Details", "Type", "IP", "Time"].join(","),
      ...filteredLogs.map(log => [
        log.user,
        log.action,
        log.tool,
        log.details || "",
        log.type,
        log.ip,
        log.time
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Activity logs exported!", {
      description: "CSV file downloaded successfully.",
    });
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
          <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground">
            Monitor all user activity and admin actions
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="gradient" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="access">Tool Access</SelectItem>
            <SelectItem value="auth">Authentication</SelectItem>
            <SelectItem value="admin">Admin Actions</SelectItem>
            <SelectItem value="security">Security Events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Table */}
      <Card className="border-2 border-border/50 shadow-card overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Target</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Time</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">
                  IP Address
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const IconComponent = ActionIcon({ type: log.type, action: log.action });
                return (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.user_name || log.user}</p>
                        <p className="text-xs text-muted-foreground">{log.user}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-md ${
                            log.type === "access"
                              ? "bg-primary/10 text-primary"
                              : log.type === "auth"
                              ? "bg-success-light text-success"
                              : log.type === "admin"
                              ? "bg-admin-light text-admin"
                              : "bg-warning-light text-warning"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium">{log.action}</span>
                          {log.details && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.tool}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {log.time}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.ip || "N/A"}
                      </code>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? "No activity logs found matching your criteria." : "No activity logs recorded yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Activity will appear here when admins suspend users or assign tools.
          </p>
        </div>
      )}
    </div>
  );
};
