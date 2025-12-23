import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useSupport } from "@/context/SupportContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Bot,
  Loader2,
  Sparkles,
  UserCheck,
  Eye,
  Search,
  Filter,
  MessageSquare,
  XCircle,
} from "lucide-react";

const statusColors = {
  open: "warning",
  analyzed: "default",
  in_progress: "default",
  resolved: "success",
};

const statusLabels = {
  open: "Open",
  analyzed: "AI Analyzed",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const priorityColors = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
};

const categoryLabels = {
  tool_access: "Tool Access",
  login: "Login/Auth",
  performance: "Performance",
  ui_bug: "UI Bug",
  other: "Other",
};

export const IssuesPage = () => {
  const { user } = useAuth();
  const { issues, analyzeWithAI, updateIssue, resolveIssue, isLoading, refreshIssues } = useSupport();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isSuperAdmin = user?.role === "Super Administrator";
  const isAdmin = user?.role === "Administrator";

  // Refresh issues on mount
  useEffect(() => {
    if (user) {
      refreshIssues();
    }
  }, [user]);

  // Super Admin sees all, others see only their own (filtered by backend)
  const displayIssues = issues;

  // Filter issues
  const filteredIssues = displayIssues.filter((issue) => {
    const matchesSearch =
      issue.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openIssues = filteredIssues.filter((i) => i.status !== "resolved");
  const resolvedIssues = filteredIssues.filter((i) => i.status === "resolved");

  const handleAnalyzeWithAI = async (issueId) => {
    setIsAnalyzing(true);
    toast.info("Sending to Emergent AI for analysis...");

    try {
      const analysis = await analyzeWithAI(issueId);
      if (analysis) {
        toast.success("AI Analysis Complete!", {
          description: `Confidence: ${Math.round(analysis.confidence * 100)}%`,
        });
        // Refresh selected issue
        const updated = issues.find((i) => i.id === issueId);
        if (updated) setSelectedIssue({ ...updated, ai_analysis: analysis });
      }
    } catch (error) {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      toast.error("Please add a resolution note");
      return;
    }

    setIsResolving(true);
    try {
      await resolveIssue(selectedIssue.id, resolutionNote);
      toast.success("Issue resolved!", {
        description: `User ${selectedIssue.user_name} will be notified.`,
      });
      setSelectedIssue(null);
      setResolutionNote("");
    } catch (error) {
      toast.error(`Failed to resolve issue: ${error.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateIssue(selectedIssue.id, { admin_notes: adminNotes });
      toast.success("Notes saved!");
    } catch (error) {
      toast.error(`Failed to save notes: ${error.message}`);
    }
  };

  const handleMarkInProgress = async () => {
    try {
      await updateIssue(selectedIssue.id, { status: "in_progress" });
      toast.success("Status updated to In Progress");
      setSelectedIssue({ ...selectedIssue, status: "in_progress" });
    } catch (error) {
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Clock className="h-4 w-4" />;
      case "analyzed":
        return <Sparkles className="h-4 w-4" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSuperAdmin ? "All Reported Issues" : "My Reported Issues"}
          </h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? "View and manage all user-reported issues"
              : "Track the status of your reported issues"}
          </p>
        </div>
      </div>

      {/* Info banner for non-Super Admin users */}
      {!isSuperAdmin && (
        <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Limited View</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You can see the status of your issues (Open, In Progress, Resolved). 
            Resolution details are only visible to Super Admin.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-2 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{displayIssues.length}</p>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-light">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayIssues.filter((i) => i.status === "open").length}
              </p>
              <p className="text-sm text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Loader2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayIssues.filter((i) => ["analyzed", "in_progress"].includes(i.status)).length}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-light">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayIssues.filter((i) => i.status === "resolved").length}
              </p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="analyzed">AI Analyzed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Issues Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Clock className="h-4 w-4" />
            Active ({openIssues.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Resolved ({resolvedIssues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {openIssues.length === 0 ? (
            <Card className="border-2 border-border/50">
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Issues</h3>
                <p className="text-muted-foreground">
                  {isAdmin
                    ? "All issues have been resolved. Great job!"
                    : "You don't have any open issues."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {openIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  isSuperAdmin={isSuperAdmin}
                  onView={() => {
                    setSelectedIssue(issue);
                    setAdminNotes(issue.admin_notes || "");
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved">
          {resolvedIssues.length === 0 ? (
            <Card className="border-2 border-border/50">
              <CardContent className="p-12 text-center">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Resolved Issues</h3>
                <p className="text-muted-foreground">Resolved issues will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {resolvedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  isSuperAdmin={isSuperAdmin}
                  onView={() => {
                    setSelectedIssue(issue);
                    setAdminNotes(issue.admin_notes || "");
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedIssue.status)}
                  {selectedIssue.title}
                </DialogTitle>
                <DialogDescription>
                  {isAdmin
                    ? `Reported by ${selectedIssue.user_name} (${selectedIssue.user_email})`
                    : `Submitted on ${new Date(selectedIssue.created_at).toLocaleDateString()}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Issue Info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant={statusColors[selectedIssue.status]}>
                      {statusLabels[selectedIssue.status]}
                    </Badge>
                    <Badge variant={priorityColors[selectedIssue.priority]}>
                      {selectedIssue.priority} priority
                    </Badge>
                    <Badge variant="outline">
                      {categoryLabels[selectedIssue.category] || selectedIssue.category}
                    </Badge>
                  </div>
                  <p className="text-sm">{selectedIssue.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted: {new Date(selectedIssue.created_at).toLocaleString()}
                  </p>
                </div>

                {/* AI Analysis Section - Only Super Admin can see */}
                {isSuperAdmin && selectedIssue.ai_analysis ? (
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Diagnosis
                      </span>
                      <Badge variant="default">
                        {Math.round(selectedIssue.ai_analysis.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm mb-4">{selectedIssue.ai_analysis.diagnosis}</p>

                    <Label className="text-sm font-medium">Suggested Fix:</Label>
                    <pre className="text-sm mt-1 p-3 rounded bg-muted whitespace-pre-wrap">
                      {selectedIssue.ai_analysis.suggested_fix}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      Analyzed: {new Date(selectedIssue.ai_analysis.analyzed_at).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  isSuperAdmin && (
                    <div className="p-4 rounded-lg border border-dashed border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            AI analysis not yet performed
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="gradient"
                          onClick={() => handleAnalyzeWithAI(selectedIssue.id)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Send to Emergent
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                )}

                {/* Resolution (for resolved issues) - Different view for Super Admin vs others */}
                {selectedIssue.status === "resolved" && (
                  <div className="p-4 rounded-lg bg-success-light border border-success/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="font-medium text-success">Resolved</span>
                    </div>
                    {isSuperAdmin && selectedIssue.resolution?.note ? (
                      <>
                        <p className="text-sm">{selectedIssue.resolution.note}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Resolved by {selectedIssue.resolution.resolved_by} on{" "}
                          {new Date(selectedIssue.resolution.resolved_at).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Your issue has been resolved. If you have further questions, please submit a new issue.
                      </p>
                    )}
                  </div>
                )}

                {/* Super Admin-only sections */}
                {isSuperAdmin && selectedIssue.status !== "resolved" && (
                  <>
                    {/* Admin Notes */}
                    <div className="space-y-2">
                      <Label>Admin Notes (Internal)</Label>
                      <Textarea
                        placeholder="Add internal notes about this issue..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                      />
                      <Button size="sm" variant="outline" onClick={handleSaveNotes}>
                        Save Notes
                      </Button>
                    </div>

                    <Separator />

                    {/* Resolution */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-success" />
                        Resolve & Notify User
                      </Label>
                      <Textarea
                        placeholder="Describe the resolution and any steps the user should take..."
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <Button
                          variant="gradient"
                          className="flex-1 gap-2"
                          onClick={handleResolve}
                          disabled={isResolving}
                        >
                          {isResolving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Resolving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Resolve & Send to User
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleMarkInProgress}
                        >
                          Mark In Progress
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* User/Admin view - waiting message */}
                {!isSuperAdmin && selectedIssue.status !== "resolved" && (
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Your issue is being reviewed</p>
                    <p className="text-sm text-muted-foreground">
                      Our team is working on resolving your issue. You'll be notified once it's resolved.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Issue Card Component
const IssueCard = ({ issue, isSuperAdmin, onView }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Clock className="h-4 w-4 text-warning" />;
      case "analyzed":
        return <Sparkles className="h-4 w-4 text-primary" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-primary" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <Card className="border-2 border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={onView}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {getStatusIcon(issue.status)}
              <h3 className="font-semibold truncate">{issue.title}</h3>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={statusColors[issue.status]} className="text-xs">
                {statusLabels[issue.status]}
              </Badge>
              <Badge variant={priorityColors[issue.priority]} className="text-xs">
                {issue.priority}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {categoryLabels[issue.category] || issue.category}
              </Badge>
              {isSuperAdmin && issue.ai_analysis && (
                <Badge variant="default" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Analyzed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {issue.description}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {isSuperAdmin && <span>By: {issue.user_name}</span>}
              <span>{new Date(issue.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
