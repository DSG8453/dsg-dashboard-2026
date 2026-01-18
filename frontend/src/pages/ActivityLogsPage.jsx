import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Trash2,
  MoreVertical,
  Users,
  Shield,
  User,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { activityLogsAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const ActionIcon = ({ type, action }) => {
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

const getRoleBadgeVariant = (role) => {
  switch (role) {
    case "Super Administrator":
      return "admin";
    case "Administrator":
      return "warning";
    case "User":
      return "default";
    default:
      return "secondary";
  }
};

const getRoleIcon = (role) => {
  switch (role) {
    case "Super Administrator":
      return Crown;
    case "Administrator":
      return Shield;
    case "User":
      return User;
    default:
      return Users;
  }
};

export const ActivityLogsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [activityLogs, setActivityLogs] = useState([]);
  const [usersWithLogs, setUsersWithLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState([]);
  
  // Delete dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [selectedLogToDelete, setSelectedLogToDelete] = useState(null);
  const [selectedUserToDelete, setSelectedUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user is Super Admin - redirect if not
  useEffect(() => {
    if (user && user.role !== "Super Administrator") {
      toast.error("Access denied. Super Admin only.");
      navigate("/", { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch users with logs for filter
  const fetchUsersWithLogs = useCallback(async () => {
    try {
      const users = await activityLogsAPI.getUsersWithLogs();
      setUsersWithLogs(users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  // Fetch activity logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const userEmail = filterUser !== "all" ? filterUser : null;
      const logs = await activityLogsAPI.getAll(200, filterType, filterRole, userEmail);
      setActivityLogs(logs);
      setSelectedLogs([]);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
      toast.error("Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  }, [filterRole, filterType, filterUser]);

  useEffect(() => {
    fetchUsersWithLogs();
  }, [fetchUsersWithLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tool?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleRefresh = () => {
    fetchLogs();
    fetchUsersWithLogs();
    toast.success("Activity logs refreshed!");
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const csvContent = [
      ["User", "User Role", "Action", "Target", "Details", "Type", "IP", "Time"].join(","),
      ...filteredLogs.map(log => [
        log.user,
        log.user_role || "Unknown",
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

  // Delete single log
  const handleDeleteLog = async () => {
    if (!selectedLogToDelete) return;
    
    setIsDeleting(true);
    try {
      await activityLogsAPI.delete(selectedLogToDelete.id);
      setActivityLogs(activityLogs.filter(log => log.id !== selectedLogToDelete.id));
      toast.success("Activity log deleted");
      setDeleteDialogOpen(false);
      setSelectedLogToDelete(null);
    } catch (error) {
      toast.error(`Failed to delete log: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete all logs for a user
  const handleDeleteUserLogs = async () => {
    if (!selectedUserToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await activityLogsAPI.deleteUserLogs(selectedUserToDelete);
      setActivityLogs(activityLogs.filter(log => log.user !== selectedUserToDelete));
      toast.success(`Deleted ${result.deleted_count} logs for ${selectedUserToDelete}`);
      setDeleteUserDialogOpen(false);
      setSelectedUserToDelete(null);
      fetchUsersWithLogs(); // Refresh users list
    } catch (error) {
      toast.error(`Failed to delete logs: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open delete confirmation for single log
  const openDeleteLogDialog = (log) => {
    setSelectedLogToDelete(log);
    setDeleteDialogOpen(true);
  };

  // Open delete confirmation for all user logs
  const openDeleteUserLogsDialog = (userEmail) => {
    setSelectedUserToDelete(userEmail);
    setDeleteUserDialogOpen(true);
  };

  // Get unique users from current filtered logs
  const uniqueUsersInLogs = [...new Set(filteredLogs.map(log => log.user))];

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
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Activity Type Filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue placeholder="Activity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="access">Tool Access</SelectItem>
            <SelectItem value="auth">Authentication</SelectItem>
            <SelectItem value="admin">Admin Actions</SelectItem>
            <SelectItem value="security">Security Events</SelectItem>
          </SelectContent>
        </Select>

        {/* User Role Filter */}
        <Select value={filterRole} onValueChange={(val) => { setFilterRole(val); setFilterUser("all"); }}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="User Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="Super Administrator">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-admin" />
                Super Admin
              </div>
            </SelectItem>
            <SelectItem value="Administrator">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-warning" />
                Administrator
              </div>
            </SelectItem>
            <SelectItem value="User">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Specific User Filter */}
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Filter by User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {usersWithLogs.map((u) => (
              <SelectItem key={u.email} value={u.email}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="truncate">{u.name}</span>
                  <Badge variant="outline" className="text-xs">{u.log_count}</Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-2 border-border/50">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{filteredLogs.length}</p>
            <p className="text-sm text-muted-foreground">Total Logs</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-admin/30 bg-admin/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-admin">
              {filteredLogs.filter(l => l.user_role === "Super Administrator").length}
            </p>
            <p className="text-sm text-muted-foreground">Super Admin</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-warning">
              {filteredLogs.filter(l => l.user_role === "Administrator").length}
            </p>
            <p className="text-sm text-muted-foreground">Administrator</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">
              {filteredLogs.filter(l => l.user_role === "User").length}
            </p>
            <p className="text-sm text-muted-foreground">User</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Delete Per User */}
      {usersWithLogs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Quick delete by user:</span>
          {usersWithLogs.slice(0, 5).map((u) => (
            <Button
              key={u.email}
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => openDeleteUserLogsDialog(u.email)}
            >
              <Trash2 className="h-3 w-3" />
              {u.name} ({u.log_count})
            </Button>
          ))}
          {usersWithLogs.length > 5 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  +{usersWithLogs.length - 5} more
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {usersWithLogs.slice(5).map((u) => (
                  <DropdownMenuItem
                    key={u.email}
                    onClick={() => openDeleteUserLogsDialog(u.email)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {u.name} ({u.log_count} logs)
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Activity Table */}
      <Card className="border-2 border-border/50 shadow-card overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Target</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Time</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">IP</TableHead>
                <TableHead className="font-semibold w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const IconComponent = ActionIcon({ type: log.type, action: log.action });
                const RoleIcon = getRoleIcon(log.user_role);
                return (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.user_name || log.user}</p>
                        <p className="text-xs text-muted-foreground">{log.user}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(log.user_role)} className="gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {log.user_role === "Super Administrator" ? "Super Admin" : 
                         log.user_role === "Administrator" ? "Admin" : 
                         log.user_role || "Unknown"}
                      </Badge>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openDeleteLogDialog(log)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Log
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteUserLogsDialog(log.user)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Delete All by {log.user_name}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            {searchQuery || filterType !== "all" || filterRole !== "all" || filterUser !== "all"
              ? "No activity logs found matching your criteria."
              : "No activity logs recorded yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Activity will appear here when admins perform actions.
          </p>
        </div>
      )}

      {/* Delete Single Log Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity log?
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedLogToDelete?.action}</p>
                <p className="text-sm text-muted-foreground">
                  By: {selectedLogToDelete?.user_name} • {selectedLogToDelete?.time}
                </p>
              </div>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLog}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Logs Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete All User Logs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">ALL activity logs</span> for:
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="font-medium text-destructive">{selectedUserToDelete}</p>
                <p className="text-sm text-muted-foreground">
                  {usersWithLogs.find(u => u.email === selectedUserToDelete)?.log_count || 0} log(s) will be permanently deleted
                </p>
              </div>
              This action cannot be undone!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUserLogs}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete All Logs"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
