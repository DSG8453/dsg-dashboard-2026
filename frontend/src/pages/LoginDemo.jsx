import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Demo page to show all color schemes
export const LoginDemo = () => {
  const [selected, setSelected] = useState(null);

  const schemes = [
    { 
      id: "white", 
      name: "Option 1: Clean White (Same as PDF)", 
      bg: "bg-gray-50",
      card: "bg-white shadow-xl",
      text: "text-gray-900",
      subtext: "text-gray-500",
      button: "bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700",
    },
    { 
      id: "dark", 
      name: "Option 2: Dark Theme", 
      bg: "bg-gray-900",
      card: "bg-gray-800 shadow-2xl border border-gray-700",
      text: "text-white",
      subtext: "text-gray-400",
      button: "bg-gray-700 border-2 border-gray-600 hover:bg-gray-600 text-white",
    },
    { 
      id: "blue", 
      name: "Option 3: Blue Theme", 
      bg: "bg-blue-600",
      card: "bg-white shadow-xl",
      text: "text-gray-900",
      subtext: "text-gray-500",
      button: "bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700",
    },
    { 
      id: "gradient", 
      name: "Option 4: Gradient Theme", 
      bg: "bg-gradient-to-br from-blue-100 via-white to-indigo-100",
      card: "bg-white/95 backdrop-blur shadow-xl",
      text: "text-gray-900",
      subtext: "text-gray-500",
      button: "bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700",
    },
  ];

  const LoginCard = ({ scheme }) => (
    <div className={`${scheme.bg} rounded-2xl p-6 flex items-center justify-center min-h-[400px]`}>
      <div className="w-full max-w-xs">
        <div className={`${scheme.card} rounded-2xl p-6 text-center`}>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
            alt="DSG Transport LLC"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className={`text-lg font-medium ${scheme.text} mb-6`}>
            DSG transport llc
          </h1>
          <Button
            variant="outline"
            className={`w-full h-11 gap-2 text-sm font-medium rounded-lg ${scheme.button}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>
          <p className={`text-[10px] ${scheme.subtext} mt-4`}>
            © 2025 DSG Transport LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold text-center mb-8">Login Page Color Schemes - Choose One</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {schemes.map((scheme) => (
          <div key={scheme.id} className="space-y-2">
            <h2 className="font-semibold text-gray-700">{scheme.name}</h2>
            <LoginCard scheme={scheme} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginDemo;
