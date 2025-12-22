import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * AuthCallback component handles the Google OAuth callback.
 * It processes the session_id from the URL fragment and exchanges it for a JWT token.
 * 
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export const AuthCallback = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      // Extract session_id from URL fragment (after #)
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      const sessionId = params.get("session_id");

      if (!sessionId) {
        toast.error("Invalid authentication callback");
        navigate("/login", { replace: true });
        return;
      }

      try {
        const result = await loginWithGoogle(sessionId);

        if (result.success) {
          toast.success("Welcome!", {
            description: `Signed in as ${result.user.name}`,
          });
          // Navigate to dashboard with user data
          navigate("/", { replace: true, state: { user: result.user } });
        } else {
          toast.error("Login Failed", {
            description: result.error,
          });
          navigate("/login", { replace: true });
        }
      } catch (error) {
        console.error("Google auth callback error:", error);
        toast.error("Authentication failed", {
          description: "Please try again or use email login.",
        });
        navigate("/login", { replace: true });
      }
    };

    processSession();
  }, [location.hash, loginWithGoogle, navigate]);

  return (
    <div className="min-h-screen bg-gradient-dsg flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Signing you in...
        </h2>
        <p className="text-muted-foreground">
          Please wait while we verify your Google account.
        </p>
      </div>
    </div>
  );
};
