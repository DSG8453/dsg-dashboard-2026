import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Shield, ArrowLeft, KeyRound, RefreshCw } from "lucide-react";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 2SV state
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  
  const { login, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        if (result.requiresOtp) {
          // Show OTP screen
          setTempToken(result.tempToken);
          setShowOtpScreen(true);
          setResendCooldown(60);
          toast.info("Verification Required", {
            description: result.message,
          });
          // Focus first OTP input
          setTimeout(() => otpRefs[0].current?.focus(), 100);
        } else {
          // Direct login successful
          toast.success("Welcome back!", {
            description: "You have been successfully signed in.",
          });
          navigate("/");
        }
      } else {
        toast.error("Login Failed", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last digit
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
    
    // Auto-submit when all digits entered
    if (newOtp.every(d => d) && newOtp.join("").length === 6) {
      handleOtpSubmit(newOtp.join(""));
    }
  };

  // Handle backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // Handle paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      handleOtpSubmit(pastedData);
    }
  };

  // Submit OTP
  const handleOtpSubmit = async (otpCode = otp.join("")) => {
    if (otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await verifyOtp(email, otpCode, tempToken);
      
      if (result.success) {
        toast.success("Verification Successful!", {
          description: "You have been successfully signed in.",
        });
        navigate("/");
      } else {
        toast.error("Verification Failed", {
          description: result.error,
        });
        // Clear OTP inputs
        setOtp(["", "", "", "", "", ""]);
        otpRefs[0].current?.focus();
      }
    } catch (error) {
      toast.error("An error occurred during verification");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    try {
      const result = await resendOtp(tempToken);
      if (result.success) {
        toast.success("Code Resent", {
          description: result.message,
        });
        setResendCooldown(60);
        setOtp(["", "", "", "", "", ""]);
        otpRefs[0].current?.focus();
      } else {
        toast.error("Failed to resend code", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  // Back to login
  const handleBackToLogin = () => {
    setShowOtpScreen(false);
    setOtp(["", "", "", "", "", ""]);
    setTempToken("");
    setPassword("");
  };

  const handleSSOLogin = async (provider) => {
    if (provider === "Google") {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/';
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      // Use window.location.replace for cleaner redirect (replaces current history entry)
      window.location.replace(authUrl);
    } else {
      toast.info(`${provider} SSO`, {
        description: "Microsoft SSO is not available. Please use Google or email login.",
      });
    }
  };

  // OTP Verification Screen
  if (showOtpScreen) {
    return (
      <div className="min-h-screen bg-gradient-dsg flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
                alt="DSG Transport LLC"
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground">DSG TRANSPORT LLC</h1>
            <p className="text-muted-foreground">2-Step Verification</p>
          </div>

          <Card className="border-2 border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Enter Verification Code</CardTitle>
              <CardDescription>
                We've sent a 6-digit code to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* OTP Input */}
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold"
                    disabled={isLoading}
                  />
                ))}
              </div>

              {/* Verify Button */}
              <Button
                variant="gradient"
                className="w-full h-11"
                onClick={() => handleOtpSubmit()}
                disabled={isLoading || otp.join("").length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              {/* Resend Code */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Didn't receive the code?
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </Button>
              </div>

              <Separator />

              {/* Back to Login */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleBackToLogin}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Button>

              {/* Info */}
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                <p className="font-medium text-warning mb-1">⚠️ Security Notice</p>
                <p className="text-muted-foreground text-xs">
                  This code expires in 5 minutes. Never share this code with anyone.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Regular Login Screen
  return (
    <div className="min-h-screen bg-gradient-dsg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
              alt="DSG Transport LLC"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">DSG TRANSPORT LLC</h1>
          <p className="text-muted-foreground">Management Portal</p>
        </div>

        <Card className="border-2 border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Secure Login</CardTitle>
            <CardDescription>
              Sign in to access company tools and resources
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* SSO Buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11 gap-3"
                onClick={() => handleSSOLogin("Microsoft")}
              >
                <svg className="h-5 w-5" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Continue with Microsoft
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-11 gap-3"
                onClick={() => handleSSOLogin("Google")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@dsgtransport.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Info about 2SV */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <p className="font-medium text-primary mb-1">🔐 2-Step Verification</p>
              <p className="text-muted-foreground text-xs">
                For enhanced security, some accounts require email verification on each login.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Protected by enterprise-grade security
        </p>
      </div>
    </div>
  );
};
