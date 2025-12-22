import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const HeaderCard = ({ currentUser, onAddTool }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrator";

  return (
    <Card className="glass-card-strong border-2 border-border/50 shadow-lg mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
              alt="DSG Transport LLC"
              className="h-14 w-auto"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                DSG TRANSPORT LLC
              </h1>
              <p className="text-muted-foreground">
                Welcome back,{" "}
                <span className="font-semibold text-foreground">
                  {currentUser?.name || "User"}
                </span>
                <span className="text-admin font-semibold"> • {currentUser?.role || "User"}</span>
              </p>
            </div>
          </div>

          {/* Add Tool button - Admin only */}
          {isAdmin && (
            <Button variant="gradient" onClick={onAddTool} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Tool
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
