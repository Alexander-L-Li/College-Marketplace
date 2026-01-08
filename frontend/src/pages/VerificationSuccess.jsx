import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerificationSuccess() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Email verified!
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account is ready. You can now log in.
          </p>
        </div>

        <Button asChild className="w-full font-semibold">
          <Link to="/login">Continue to Login</Link>
        </Button>
      </div>
    </div>
  );
}


