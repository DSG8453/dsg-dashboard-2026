import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import { devicesAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  Monitor,
  Smartphone,
  Tablet,
  Settings,
  Trash2,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Globe,
} from "lucide-react";

const getDeviceIcon = (deviceName) => {
  const name = deviceName?.toLowerCase() || "";
  if (name.includes("mobile") || name.includes("android") || name.includes("iphone")) {
    return Smartphone;
  }
  if (name.includes("ipad") || name.includes("tablet")) {
    return Tablet;
  }
  return Monitor;
};

const getStatusBadge = (status) => {
  const variants = {
    approved: "active",
    pending: "warning",
    rejected: "destructive",
    revoked: "destructive",
  };
  return variants[status] || "secondary";
};

const formatDate = (dateString) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
  
  return date.toLocaleDateString();
};

export const DevicesPage = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Super Admin and Admin can manage devices
  const canManageDevices = user?.role === "Super Administrator" || user?.role === "Administrator";

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const data = canManageDevices ? await devicesAPI.getAll() : await devicesAPI.getMyDevices();
      setDevices(data);
    } catch (error) {
      toast.error("Failed to load devices");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [canManageDevices]);

  const handleManageDevice = (device) => {
    setSelectedDevice(device);
    setManageDialogOpen(true);
  };

  const approveDevice = async () => {
    setIsProcessing(true);
    try {
      await devicesAPI.approve(selectedDevice.id);
      setDevices(devices.map((d) =>
        d.id === selectedDevice.id ? { ...d, status: "approved" } : d
      ));
      toast.success(`Device approved for ${selectedDevice.user_name}`);
      setManageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to approve device");
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectDevice = async () => {
    setIsProcessing(true);
    try {
      await devicesAPI.reject(selectedDevice.id);
      setDevices(devices.map((d) =>
        d.id === selectedDevice.id ? { ...d, status: "rejected" } : d
      ));
      toast.warning(`Device rejected for ${selectedDevice.user_name}`);
      setManageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to reject device");
    } finally {
      setIsProcessing(false);
    }
  };

  const revokeDevice = async () => {
    setIsProcessing(true);
    try {
      await devicesAPI.revoke(selectedDevice.id);
      setDevices(devices.map((d) =>
        d.id === selectedDevice.id ? { ...d, status: "revoked" } : d
      ));
      toast.warning(`Device access revoked for ${selectedDevice.user_name}`);
      setManageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to revoke device");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeDevice = async () => {
    setIsProcessing(true);
    try {
      await devicesAPI.delete(selectedDevice.id);
      setDevices(devices.filter((d) => d.id !== selectedDevice.id));
      toast.success("Device removed from records");
      setManageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to remove device");
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingDevices = devices.filter((d) => d.status === "pending");
  const approvedDevices = devices.filter((d) => d.status === "approved");
  const otherDevices = devices.filter((d) => !["pending", "approved"].includes(d.status));

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
          <h1 className="text-2xl font-bold text-foreground">Device Management</h1>
          <p className="text-muted-foreground">
            {canManageDevices 
              ? "Approve and monitor devices used by team members"
              : "View your registered devices"
            }
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchDevices}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats - Admin/Super Admin Only */}
      {canManageDevices && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card className="border-2 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Monitor className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{devices.length}</p>
                <p className="text-sm text-muted-foreground">Total Devices</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingDevices.length}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{approvedDevices.length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{otherDevices.length}</p>
                <p className="text-sm text-muted-foreground">Rejected/Revoked</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Devices Alert - Admin/Super Admin Only */}
      {canManageDevices && pendingDevices.length > 0 && (
        <Card className="border-2 border-warning/50 bg-warning/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-warning" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {pendingDevices.length} Device(s) Awaiting Approval
                </h3>
                <p className="text-sm text-muted-foreground">
                  Review and approve new devices to grant access
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Tabs - Admin/Super Admin Only */}
      {canManageDevices ? (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending ({pendingDevices.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved ({approvedDevices.length})
            </TabsTrigger>
            <TabsTrigger value="other" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected/Revoked ({otherDevices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <DeviceTable 
              devices={pendingDevices} 
              onManage={handleManageDevice}
              showUser={true}
            />
          </TabsContent>

          <TabsContent value="approved">
            <DeviceTable 
              devices={approvedDevices} 
              onManage={handleManageDevice}
              showUser={true}
            />
          </TabsContent>

          <TabsContent value="other">
            <DeviceTable 
              devices={otherDevices} 
              onManage={handleManageDevice}
              showUser={true}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <DeviceTable devices={devices} showUser={false} />
      )}

      {/* Manage Device Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Device</DialogTitle>
            <DialogDescription>Update device access permissions</DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = getDeviceIcon(selectedDevice.device_name);
                    return <Icon className="h-5 w-5" />;
                  })()}
                  <span className="font-semibold">{selectedDevice.device_name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  User: {selectedDevice.user_name} ({selectedDevice.user_email})
                </p>
                <p className="text-sm text-muted-foreground">
                  Browser: {selectedDevice.browser}
                </p>
                <p className="text-sm text-muted-foreground">
                  OS: {selectedDevice.os}
                </p>
                <p className="text-sm text-muted-foreground">
                  IP Address: {selectedDevice.ip_address}
                </p>
                <p className="text-sm text-muted-foreground">
                  Registered: {formatDate(selectedDevice.created_at)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last Login: {formatDate(selectedDevice.last_login)}
                </p>
                <div className="pt-2">
                  <Badge variant={getStatusBadge(selectedDevice.status)}>
                    {selectedDevice.status?.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {selectedDevice.status === "pending" && (
                  <>
                    <Button 
                      variant="gradient" 
                      className="gap-2" 
                      onClick={approveDevice}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Approve Device
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                      onClick={rejectDevice}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Device
                    </Button>
                  </>
                )}
                
                {selectedDevice.status === "approved" && (
                  <Button
                    variant="outline"
                    className="gap-2 border-warning text-warning hover:bg-warning/10"
                    onClick={revokeDevice}
                    disabled={isProcessing}
                  >
                    <Shield className="h-4 w-4" />
                    Revoke Access
                  </Button>
                )}

                {(selectedDevice.status === "rejected" || selectedDevice.status === "revoked") && (
                  <Button 
                    variant="gradient" 
                    className="gap-2" 
                    onClick={approveDevice}
                    disabled={isProcessing}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Re-approve Device
                  </Button>
                )}

                <Button 
                  variant="destructive" 
                  className="gap-2" 
                  onClick={removeDevice}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Device
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Device Table Component
const DeviceTable = ({ devices, onManage, showUser = true }) => {
  if (devices.length === 0) {
    return (
      <Card className="border-2 border-border/50">
        <CardContent className="p-12 text-center">
          <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Devices Found</h3>
          <p className="text-muted-foreground">
            No devices in this category
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-border/50 shadow-card overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {showUser && <TableHead className="font-semibold">User</TableHead>}
              <TableHead className="font-semibold">Device</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">IP Address</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Last Login</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              {onManage && <TableHead className="font-semibold text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.device_name);
              return (
                <TableRow key={device.id} className="hover:bg-muted/30">
                  {showUser && (
                    <TableCell>
                      <div>
                        <p className="font-medium">{device.user_name}</p>
                        <p className="text-sm text-muted-foreground">{device.user_email}</p>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{device.device_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.browser} / {device.os}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      {device.ip_address}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(device.last_login)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(device.status)}>
                      {device.status?.charAt(0).toUpperCase() + device.status?.slice(1)}
                    </Badge>
                  </TableCell>
                  {onManage && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => onManage(device)}
                      >
                        <Settings className="h-4 w-4" />
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
