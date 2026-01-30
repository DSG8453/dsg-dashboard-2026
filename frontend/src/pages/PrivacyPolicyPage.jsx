import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Database, Mail, FileText, Users } from "lucide-react";

export const PrivacyPolicyPage = () => {
  const lastUpdated = "January 29, 2026";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
              alt="DSG Transport LLC"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600">DSG Transport Secure Portal</p>
          <p className="text-sm text-gray-500 mt-2">Last Updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <Card className="shadow-lg">
          <CardContent className="p-8 space-y-8">
            {/* Introduction */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Introduction</h2>
              </div>
              <p className="text-gray-700 leading-relaxed">
                DSG Transport LLC ("Company," "we," "our," or "us") is committed to protecting your privacy. 
                This Privacy Policy explains how the DSG Transport Secure Portal 
                ("Portal") collects, uses, and safeguards your information when you use our Portal 
                to access licensed third-party business applications authorized by DSG Transport LLC.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Information We Collect</h2>
              </div>
              <p className="text-gray-700 mb-3">The Portal collects the following information:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Device Information:</strong> Browser type, device fingerprint, and IP address for device authentication and security purposes.</li>
                <li><strong>Authentication Data:</strong> Login credentials that are securely stored in Google Secret Manager and used solely for automated login to licensed third-party business applications authorized by DSG Transport LLC.</li>
                <li><strong>Usage Data:</strong> Information about which licensed applications are accessed and when, for audit and security logging purposes.</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">How We Use Your Information</h2>
              </div>
              <p className="text-gray-700 mb-3">We use the collected information for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>To provide secure access to licensed third-party business applications authorized by DSG Transport LLC</li>
                <li>To authenticate and verify authorized devices</li>
                <li>To maintain security and prevent unauthorized access</li>
                <li>To generate activity logs for compliance and auditing purposes</li>
                <li>To improve the Portal's functionality and user experience</li>
              </ul>
            </section>

            {/* Data Storage and Security */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Data Storage and Security</h2>
              </div>
              <p className="text-gray-700 mb-3">DSG Transport LLC takes data security seriously:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>All credentials are stored securely in Google Cloud Secret Manager</li>
                <li>Credentials are never exposed to the frontend or user's browser</li>
                <li>All authentication happens server-side through a secure gateway</li>
                <li>We implement role-based access controls to limit data access</li>
                <li>Regular security audits are conducted to ensure data protection</li>
                <li>All data transmission uses industry-standard TLS encryption</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Data Sharing</h2>
              </div>
              <p className="text-gray-700 leading-relaxed">
                DSG Transport LLC does not sell, trade, or otherwise transfer your personal information to third parties. 
                Your data is only shared with the specific licensed third-party business applications you are authorized to access, 
                solely for the purpose of authentication. We may disclose information if 
                required by law or to protect our rights and the security of our systems.
              </p>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
              <p className="text-gray-700 mb-3">You have the following rights regarding your data:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Access:</strong> Request a copy of the personal data DSG Transport LLC holds about you</li>
                <li><strong>Correction:</strong> Request correction of any inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
                <li><strong>Objection:</strong> Object to the processing of your personal data</li>
              </ul>
              <p className="text-gray-700 mt-3">
                To exercise any of these rights, please contact your administrator or reach out to DSG Transport LLC directly.
              </p>
            </section>

            {/* Cookies and Tracking */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies and Tracking</h2>
              <p className="text-gray-700 leading-relaxed">
                The Portal uses local storage to maintain your session and preferences. 
                DSG Transport LLC does not use third-party tracking cookies or analytics within the Portal. 
                Any data stored locally is used solely for authentication and user preferences.
              </p>
            </section>

            {/* Third-Party Applications */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Licensed Third-Party Applications</h2>
              <p className="text-gray-700 leading-relaxed">
                The Portal facilitates access to licensed third-party business applications for which 
                DSG Transport LLC holds valid subscriptions. These third-party applications have their own 
                privacy policies and terms of service. DSG Transport LLC is not responsible for the privacy 
                practices of these third-party applications. We encourage you to review the privacy policies 
                of any third-party applications you access through this Portal.
              </p>
            </section>

            {/* Changes to This Policy */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Privacy Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                DSG Transport LLC may update this Privacy Policy from time to time. Any changes will be posted on this page 
                with an updated "Last Updated" date. We encourage you to review this Privacy Policy periodically 
                for any changes. Your continued use of the Portal after any modifications indicates your 
                acceptance of the updated Privacy Policy.
              </p>
            </section>

            {/* Contact Information */}
            <section className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>
              </div>
              <p className="text-gray-700 mb-4">
                If you have any questions or concerns about this Privacy Policy or our data practices, 
                please contact DSG Transport LLC:
              </p>
              <div className="space-y-2 text-gray-700">
                <p><strong>DSG Transport LLC</strong></p>
                <p>Email: <a href="mailto:info@dsgtransport.net" className="text-blue-600 hover:underline">info@dsgtransport.net</a></p>
                <p>Website: <a href="https://portal.dsgtransport.net" className="text-blue-600 hover:underline">portal.dsgtransport.net</a></p>
              </div>
            </section>

            {/* Legal */}
            <section className="border-t pt-6">
              <p className="text-sm text-gray-500 text-center">
                © {new Date().getFullYear()} DSG Transport LLC. All rights reserved.<br />
                This privacy policy is effective as of {lastUpdated}.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
