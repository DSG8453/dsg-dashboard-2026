import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ToolCredentialsDialog } from "./ToolCredentialsDialog";
import { ExternalLink, MoreVertical, Trash2, Key, KeyRound, Check } from "lucide-react";
import { toast } from "sonner";

export const ToolCard = ({ tool, onDelete }) => {
  const { hasCredentialsForTool, getUserToolCredentials } = useAuth();
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  
  const hasCredentials = hasCredentialsForTool(tool.id);
  const credentialsCount = getUserToolCredentials(tool.id).length;

  const handleAccess = () => {
    if (hasCredentials) {
      // If user has credentials, open credentials dialog to choose which account
      setCredentialsDialogOpen(true);
    } else if (tool.url && tool.url !== "#") {
      // No credentials, just open the tool
      window.open(tool.url, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Tool URL not configured");
    }
  };

  const handleQuickLaunch = () => {
    if (tool.url && tool.url !== "#") {
      const credentials = getUserToolCredentials(tool.id);
      if (credentials.length > 0) {
        // Copy first credential's username
        navigator.clipboard.writeText(credentials[0].username);
        toast.success("Username copied!", {
          description: "Opening tool... Paste your username.",
        });
      }
      window.open(tool.url, "_blank", "noopener,noreferrer");
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
                {hasCredentials && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="success" className="gap-1">
                          <KeyRound className="h-3 w-3" />
                          {credentialsCount}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{credentialsCount} credential(s) saved</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
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
                <DropdownMenuItem onClick={() => setCredentialsDialogOpen(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  Manage Credentials
                </DropdownMenuItem>
                {hasCredentials && (
                  <DropdownMenuItem onClick={handleQuickLaunch}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Quick Launch
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(tool.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove Tool
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
            {tool.description}
          </p>

          <div className="flex gap-2">
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              onClick={handleAccess}
            >
              {hasCredentials ? (
                <>
                  <Check className="h-4 w-4" />
                  Access Tool
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Access Tool
                </>
              )}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCredentialsDialogOpen(true)}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage Credentials</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <ToolCredentialsDialog
        tool={tool}
        open={credentialsDialogOpen}
        onOpenChange={setCredentialsDialogOpen}
      />
    </>
  );
};
