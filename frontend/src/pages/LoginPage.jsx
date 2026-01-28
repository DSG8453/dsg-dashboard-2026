import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { authAPI } from "@/services/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Shield, Mail, Lock, CheckCircle } from "lucide-react";

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [passwordLoginAllowed, setPasswordLoginAllowed] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Check if we're inside an iframe (Emergent preview panel)
  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      // Direct Google OAuth - redirects to Google login page
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      window.location.href = `${backendUrl}/api/auth/google/login`;
    } catch (error) {
      setIsLoading(false);
      toast.error("Login failed", {
        description: "Please try again or contact your administrator.",
      });
    }
  };

  // NOTE: OAuth callback token handling is done in AuthCallback.jsx
  // which correctly uses dsg_token/dsg_user keys via AuthContext


  const handleCheckEmail = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await authAPI.checkPasswordAccess(email);
      
      if (response.password_login_enabled) {
        setPasswordLoginAllowed(true);
        setEmailChecked(true);
        toast.success("Password login available", {
          description: "Please enter your password to continue.",
        });
      } else {
        setPasswordLoginAllowed(false);
        setEmailChecked(true);
        toast.info("Please use Google SSO", {
          description: "Password login is not enabled for this account.",
        });
      }
    } catch (error) {
      toast.error("Error checking email", {
        description: "Please try again or use Google SSO.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        if (result.requiresOtp) {
          toast.info("2-Step Verification Required", {
            description: result.message,
          });
          // Handle OTP flow if needed
        } else {
          toast.success("Welcome back!", {
            description: "Login successful",
          });
          navigate("/", { replace: true });
        }
      } else {
        toast.error("Login failed", {
          description: result.error || "Invalid email or password",
        });
      }
    } catch (error) {
      toast.error("Login failed", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetEmailCheck = () => {
    setEmailChecked(false);
    setPasswordLoginAllowed(false);
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f0f4f8]">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
            alt="DSG Transport LLC"
            className="h-20 w-auto mx-auto"
          />
        </div>

        {/* Card */}
        <div className="bg-white shadow-lg rounded-2xl p-6">
          {!showPasswordLogin ? (
            // Default View - Google SSO Only
            <>
              <Button
                variant="outline"
                className="w-full h-12 gap-3 text-base font-medium rounded-lg bg-[#bae6fd] hover:bg-[#7dd3fc] text-gray-700 border border-gray-200"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              {/* Password Login Link */}
              <button
                type="button"
                onClick={() => setShowPasswordLogin(true)}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <Lock className="h-3 w-3" />
                Login with Email & Password
              </button>
            </>
          ) : (
            // Password Login Flow
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-700">Login with Password</span>
              </div>

              {!emailChecked ? (
                // Step 1: Enter Email
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div className="text-left space-y-2">
                    <Label htmlFor="email" className="text-gray-600">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking...
                      </>
                    ) : (
                      "Check Access"
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 mt-2">
                    Password login is only available if enabled by your administrator.
                  </p>
                </form>
              ) : passwordLoginAllowed ? (
                // Step 2b: Password Login Allowed - Show Password Field
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="text-left space-y-2">
                    <Label className="text-gray-600">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        disabled
                        className="pl-10 bg-gray-50"
                      />
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    </div>
                  </div>

                  <div className="text-left space-y-2">
                    <Label htmlFor="password" className="text-gray-600">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={resetEmailCheck}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Use different email
                  </button>
                </form>
              ) : (
                // Step 2a: Password Login NOT Allowed
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Password login is not enabled</strong> for this account.
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Please use Google SSO to login, or contact your administrator to enable password login.
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      setShowPasswordLogin(false);
                      resetEmailCheck();
                    }}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Use Google SSO Instead
                  </Button>

                  <button
                    type="button"
                    onClick={resetEmailCheck}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Try different email
                  </button>
                </div>
              )}

              {/* Back to Google SSO */}
              <button
                type="button"
                onClick={() => {
                  setShowPasswordLogin(false);
                  resetEmailCheck();
                }}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Google Sign In
              </button>
            </>
          )}
        </div>

        {/* Copyright */}
        <p className="text-xs text-gray-500 mt-6 font-semibold">
          © {new Date().getFullYear()} DSG Transport LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
};
