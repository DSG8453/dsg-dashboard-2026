import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * AuthCallback component handles the Google OAuth callback.
 * It processes the token or session_id from the URL fragment and sets up the user session.
 */
export const AuthCallback = () => {
  const { loginWithGoogle, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      console.log('[AuthCallback] Processing OAuth callback');
      console.log('[AuthCallback] Current URL:', window.location.href);
      console.log('[AuthCallback] Hash:', location.hash);
      console.log('[AuthCallback] Search:', location.search);
      
      // Extract params from URL fragment (after #)
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      
      // Also check URL query params (some errors come via query string)
      const queryParams = new URLSearchParams(location.search);
      
      // Check for direct token (from new Google OAuth flow)
      const token = params.get("token");
      
      // Check for session_id (from legacy Emergent auth flow)
      const sessionId = params.get("session_id");
      
      // Check for error in both hash and query params
      const error = params.get("error") || queryParams.get("error");
      
      console.log('[AuthCallback] Token:', token ? `${token.substring(0, 20)}...` : 'none');
      console.log('[AuthCallback] Session ID:', sessionId || 'none');
      console.log('[AuthCallback] Error:', error || 'none');
      
      if (error) {
        const email = params.get("email") || queryParams.get("email");
        let errorMessage = "Authentication failed";
        
        switch (error) {
          case 'no_account':
            errorMessage = `No account found for ${email || 'this email'}. Please contact your administrator to create an account.`;
            break;
          case 'suspended':
            errorMessage = "Your account is suspended. Please contact your administrator.";
            break;
          case 'no_code':
            errorMessage = "No authorization code received from Google. Please try again.";
            break;
          case 'no_email':
            errorMessage = "Could not retrieve email from Google. Please try again.";
            break;
          case 'oauth_failed':
            errorMessage = "Google authentication failed. Please try again.";
            break;
          case 'token_exchange_failed':
            errorMessage = "Failed to complete authentication with Google. Please try again.";
            break;
          case 'userinfo_failed':
            errorMessage = "Failed to get user information from Google. Please try again.";
            break;
          case 'domain_not_allowed':
            errorMessage = `Access denied. Your email domain is not authorized to use this system. Only @dsgtransport.net, @dsgtransport.com, and @teamdsgtransport.com emails are allowed.`;
            break;
          default:
            errorMessage = `Authentication failed: ${error}`;
        }
        
        console.error('[AuthCallback] OAuth error:', error, errorMessage);
        toast.error("Login Failed", { description: errorMessage, duration: 8000 });
        navigate("/login", { replace: true });
        return;
      }

      if (token) {
        // New direct Google OAuth flow - token received directly
        console.log('[AuthCallback] Processing JWT token from Google OAuth');
        try {
          const result = await loginWithToken(token);
          
          console.log('[AuthCallback] loginWithToken result:', result);
          
          if (result.success) {
            console.log('[AuthCallback] Login successful, redirecting to dashboard');
            toast.success("Welcome!", {
              description: `Signed in as ${result.user.name}`,
            });
            navigate("/", { replace: true });
          } else {
            console.error('[AuthCallback] Login failed:', result.error);
            toast.error("Login Failed", { 
              description: result.error || "Failed to complete login. Please try again.",
              duration: 8000 
            });
            navigate("/login", { replace: true });
          }
        } catch (error) {
          console.error("[AuthCallback] Token auth error:", error);
          toast.error("Authentication failed", {
            description: error.message || "An unexpected error occurred. Please try again.",
            duration: 8000
          });
          navigate("/login", { replace: true });
        }
        return;
      }

      if (sessionId) {
        // Legacy Emergent auth flow
        console.log('[AuthCallback] Processing legacy session ID');
        try {
          const result = await loginWithGoogle(sessionId);

          console.log('[AuthCallback] loginWithGoogle result:', result);

          if (result.success) {
            console.log('[AuthCallback] Login successful, redirecting to dashboard');
            toast.success("Welcome!", {
              description: `Signed in as ${result.user.name}`,
            });
            navigate("/", { replace: true, state: { user: result.user } });
          } else {
            console.error('[AuthCallback] Login failed:', result.error);
            toast.error("Login Failed", { 
              description: result.error || "Failed to complete login. Please try again.",
              duration: 8000 
            });
            navigate("/login", { replace: true });
          }
        } catch (error) {
          console.error("[AuthCallback] Google auth callback error:", error);
          toast.error("Authentication failed", {
            description: error.message || "An unexpected error occurred. Please try again.",
            duration: 8000
          });
          navigate("/login", { replace: true });
        }
        return;
      }

      // No token or session_id found
      console.error('[AuthCallback] No token or session_id found in URL');
      console.error('[AuthCallback] Full URL:', window.location.href);
      toast.error("Invalid authentication callback", {
        description: "No authentication data found. Please try logging in again.",
        duration: 8000
      });
      navigate("/login", { replace: true });
    };

    processSession();
  }, [location.hash, location.search, loginWithGoogle, loginWithToken, navigate]);

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
