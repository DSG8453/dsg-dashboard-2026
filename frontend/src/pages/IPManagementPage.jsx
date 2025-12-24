import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ipManagementAPI } from "@/services/api";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Globe, 
  Users, 
  Loader2, 
  Check, 
  X,
  AlertTriangle,
  Lock,
  Unlock,
  Network
} from "lucide-react";

export const IPManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "Super Administrator";
  
  // Global whitelist state
  const [whitelist, setWhitelist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIP, setSelectedIP] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newIP, setNewIP] = useState({ ip: "", description: "", status: "Active" });
  
  // User IP settings state
  const [usersIPSettings, setUsersIPSettings] = useState([]);
  const [userIPDialogOpen, setUserIPDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUserIP, setNewUserIP] = useState("");

  // Redirect non-Super Admin users
  useEffect(() => {
    if (user && !isSuperAdmin) {
      toast.error("Access denied. Super Admin only.");
      navigate("/", { replace: true });
    }
  }, [user, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data
  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [whitelistData, usersData] = await Promise.all([
        ipManagementAPI.getWhitelist(),
        ipManagementAPI.getUsersIPSettings()
      ]);
      setWhitelist(whitelistData);
      setUsersIPSettings(usersData);
    } catch (error) {
      console.error("Failed to load IP data:", error);
      toast.error("Failed to load IP management data");
    } finally {
      setIsLoading(false);
    }
  };

  // Global whitelist handlers
  const handleAddIP = async () => {
    if (!newIP.ip || !newIP.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      const result = await ipManagementAPI.addToWhitelist(newIP);
      setWhitelist([...whitelist, result]);
      setNewIP({ ip: "", description: "", status: "Active" });
      setIsAddDialogOpen(false);
      toast.success("IP added to whitelist!");
    } catch (error) {
      toast.error(`Failed to add IP: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditIP = async () => {
    if (!selectedIP || !newIP.ip || !newIP.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      await ipManagementAPI.updateWhitelist(selectedIP.id, newIP);
      setWhitelist(whitelist.map(ip => 
        ip.id === selectedIP.id ? { ...ip, ...newIP } : ip
      ));
      setIsEditDialogOpen(false);
      setSelectedIP(null);
      toast.success("IP updated!");
    } catch (error) {
      toast.error(`Failed to update IP: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteIP = async () => {
    if (!selectedIP) return;

    try {
      await ipManagementAPI.deleteFromWhitelist(selectedIP.id);
      setWhitelist(whitelist.filter(ip => ip.id !== selectedIP.id));
      setDeleteDialogOpen(false);
      setSelectedIP(null);
      toast.success("IP removed from whitelist!");
    } catch (error) {
      toast.error(`Failed to delete IP: ${error.message}`);
    }
  };

  const openEditDialog = (ip) => {
    setSelectedIP(ip);
    setNewIP({ ip: ip.ip, description: ip.description, status: ip.status });
    setIsEditDialogOpen(true);
  };

  // User IP settings handlers
  const handleToggleUserIPRestriction = async (userId, enabled) => {
    try {
      await ipManagementAPI.updateUserIPSettings(userId, { ip_restriction_enabled: enabled });
      setUsersIPSettings(usersIPSettings.map(u => 
        u.id === userId ? { ...u, ip_restriction_enabled: enabled } : u
      ));
      toast.success(enabled ? "IP restriction enabled" : "IP restriction relaxed");
    } catch (error) {
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  const handleOpenUserIPDialog = (user) => {
    setSelectedUser(user);
    setNewUserIP("");
    setUserIPDialogOpen(true);
  };

  const handleAddUserIP = async () => {
    if (!newUserIP || !selectedUser) {
      toast.error("Please enter an IP address");
      return;
    }

    setIsSaving(true);
    try {
      await ipManagementAPI.addUserIP(selectedUser.id, newUserIP);
      setUsersIPSettings(usersIPSettings.map(u => 
        u.id === selectedUser.id 
          ? { ...u, whitelisted_ips: [...(u.whitelisted_ips || []), newUserIP] }
          : u
      ));
      setSelectedUser({
        ...selectedUser,
        whitelisted_ips: [...(selectedUser.whitelisted_ips || []), newUserIP]
      });
      setNewUserIP("");
      toast.success(`IP added to ${selectedUser.name}'s whitelist`);
    } catch (error) {
      toast.error(`Failed to add IP: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveUserIP = async (ip) => {
    if (!selectedUser) return;

    try {
      await ipManagementAPI.removeUserIP(selectedUser.id, ip);
      const updatedIPs = selectedUser.whitelisted_ips.filter(i => i !== ip);
      setUsersIPSettings(usersIPSettings.map(u => 
        u.id === selectedUser.id ? { ...u, whitelisted_ips: updatedIPs } : u
      ));
      setSelectedUser({ ...selectedUser, whitelisted_ips: updatedIPs });
      toast.success("IP removed");
    } catch (error) {
      toast.error(`Failed to remove IP: ${error.message}`);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Administrator can manage IP settings.</p>
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
          <h1 className="text-2xl font-bold text-foreground">IP Management</h1>
          <p className="text-muted-foreground">
            Manage IP whitelist and user access restrictions
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Super Admin IP Bypass</p>
              <p className="text-sm text-muted-foreground">
                As Super Administrator, you are not subject to IP restrictions. You can access the system from any IP address.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="whitelist" className="space-y-6">
        <TabsList>
          <TabsTrigger value="whitelist" className="gap-2">
            <Globe className="h-4 w-4" />
            Global Whitelist
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User IP Settings
          </TabsTrigger>
        </TabsList>

        {/* Global Whitelist Tab */}
        <TabsContent value="whitelist">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Global IP Whitelist
              </CardTitle>
              <Button variant="gradient" className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add IP
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whitelist.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No IP addresses in whitelist. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    whitelist.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono">{ip.ip}</TableCell>
                        <TableCell>{ip.description}</TableCell>
                        <TableCell>
                          <Badge variant={ip.status === "Active" ? "success" : "secondary"}>
                            {ip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ip.added_by}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="iconSm" onClick={() => openEditDialog(ip)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="iconSm" 
                              className="text-destructive"
                              onClick={() => { setSelectedIP(ip); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User IP Settings Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User IP Restrictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usersIPSettings.filter(u => u.role !== "Super Administrator").map((userItem) => (
                  <div 
                    key={userItem.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium">
                        {userItem.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{userItem.name}</p>
                        <p className="text-sm text-muted-foreground">{userItem.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={userItem.role === "Administrator" ? "admin" : "user"}>
                            {userItem.role}
                          </Badge>
                          {userItem.whitelisted_ips?.length > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <Network className="h-3 w-3" />
                              {userItem.whitelisted_ips.length} IPs
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {userItem.ip_restriction_enabled ? (
                            <span className="flex items-center gap-1 text-warning">
                              <Lock className="h-4 w-4" />
                              Restricted
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-success">
                              <Unlock className="h-4 w-4" />
                              Relaxed
                            </span>
                          )}
                        </span>
                        <Switch
                          checked={userItem.ip_restriction_enabled}
                          onCheckedChange={(checked) => handleToggleUserIPRestriction(userItem.id, checked)}
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenUserIPDialog(userItem)}
                      >
                        Manage IPs
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add IP Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add IP to Whitelist
            </DialogTitle>
            <DialogDescription>
              Add an IP address or CIDR range to the global whitelist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>IP Address / CIDR</Label>
              <Input
                placeholder="e.g., 192.168.1.0/24 or 10.0.0.1"
                value={newIP.ip}
                onChange={(e) => setNewIP({ ...newIP, ip: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="e.g., Office Network, VPN Gateway"
                value={newIP.description}
                onChange={(e) => setNewIP({ ...newIP, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newIP.status} onValueChange={(v) => setNewIP({ ...newIP, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="gradient" className="flex-1" onClick={handleAddIP} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add IP"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit IP Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit IP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>IP Address / CIDR</Label>
              <Input
                value={newIP.ip}
                onChange={(e) => setNewIP({ ...newIP, ip: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newIP.description}
                onChange={(e) => setNewIP({ ...newIP, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newIP.status} onValueChange={(v) => setNewIP({ ...newIP, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="gradient" className="flex-1" onClick={handleEditIP} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User IP Management Dialog */}
      <Dialog open={userIPDialogOpen} onOpenChange={setUserIPDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Manage User IPs
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.name}'s whitelisted IP addresses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                {selectedUser?.name?.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{selectedUser?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>

            {/* Add IP */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter IP address"
                value={newUserIP}
                onChange={(e) => setNewUserIP(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddUserIP} disabled={isSaving}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* IP List */}
            <ScrollArea className="h-48 border rounded-lg p-2">
              <div className="space-y-2">
                {(!selectedUser?.whitelisted_ips || selectedUser.whitelisted_ips.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No IPs whitelisted for this user
                  </p>
                ) : (
                  selectedUser.whitelisted_ips.map((ip, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <code className="text-sm">{ip}</code>
                      <Button 
                        variant="ghost" 
                        size="iconSm" 
                        className="text-destructive"
                        onClick={() => handleRemoveUserIP(ip)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <Button variant="outline" className="w-full" onClick={() => setUserIPDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP from Whitelist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedIP?.ip}</strong> from the whitelist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIP} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
