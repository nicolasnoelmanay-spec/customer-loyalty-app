"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loyaltyConfig } from "@/config/loyalty";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isReady, isAuthenticated, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const success = login(username, password);
    if (success) {
      router.replace("/dashboard");
    } else {
      setError("Invalid username or password.");
    }
  }

  if (!isReady || isAuthenticated) {
    return null;
  }

  return (
    <>
            <AppHeader active="login" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <Lock className="size-6 text-emerald-600" />
            </div>
            <CardTitle>Staff Login</CardTitle>
            <CardDescription>
              Sign in to access the {loyaltyConfig.programName} dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Sign In
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Customer?{" "}
              <Link href="/lookup" className="text-emerald-600 hover:underline">
                Look up your points
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
