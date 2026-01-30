import { ExternalLink, Shield, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full bg-white/95 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-[#1e3a5f] rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-[#1e3a5f]">DSG Transport Portal</CardTitle>
          <CardDescription className="text-gray-600">
            Access the secure employee portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="flex items-start gap-2">
              <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                The portal cannot be embedded here due to security policies. 
                Click below to open it in a new tab.
              </span>
            </p>
          </div>
          
          <Button 
            asChild 
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4a70] text-white py-6 text-lg"
          >
            <a 
              href="https://portal.dsgtransport.net" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Open Portal
              <ExternalLink className="w-5 h-5 ml-2" />
            </a>
          </Button>

          <p className="text-center text-xs text-gray-500 pt-2">
            Your production portal runs at portal.dsgtransport.net
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
