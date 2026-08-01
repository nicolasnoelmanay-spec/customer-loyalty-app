"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Sparkles, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CustomerLoginForm } from "@/components/customer/customer-login-form";
import { MemberRegistrationForm } from "@/components/register/member-registration-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loyaltyConfig } from "@/config/loyalty";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

type LoginTab = "staff" | "customer" | "join";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady: staffReady, isAuthenticated: staffAuthenticated, login } =
    useAuth();
  const {
    isReady: customerReady,
    isAuthenticated: customerAuthenticated,
  } = useCustomerAuth();
  const [tab, setTab] = useState<LoginTab>("staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("join") === "1") {
      setTab("join");
    } else if (searchParams.get("customer") === "1") {
      setTab("customer");
    }
  }, [searchParams]);

  useEffect(() => {
    if (staffReady && staffAuthenticated) {
      router.replace("/dashboard");
    }
  }, [staffReady, staffAuthenticated, router]);

  useEffect(() => {
    if (customerReady && customerAuthenticated && tab === "customer") {
      router.replace("/customer");
    }
  }, [customerReady, customerAuthenticated, tab, router]);

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const success = await login(username, password);
    if (success) {
      router.replace("/dashboard");
    } else {
      setError("Invalid username or password.");
    }
  }

  if (!staffReady || staffAuthenticated) {
    return null;
  }

  const headerCopy =
    tab === "staff"
      ? {
          title: "Staff Login",
          description: `Sign in to access the ${loyaltyConfig.programName} dashboard.`,
          icon: Lock,
        }
      : tab === "customer"
        ? {
            title: "Customer Login",
            description: `Sign in with your member username and password.`,
            icon: Sparkles,
          }
        : {
            title: "Member Registration",
            description: `Join ${loyaltyConfig.programName} to earn rewards on every visit.`,
            icon: UserPlus,
          };

  const HeaderIcon = headerCopy.icon;

  return (
    <>
      <AppHeader active="login" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <HeaderIcon className="size-6 text-emerald-600" />
            </div>
            <CardTitle>{headerCopy.title}</CardTitle>
            <CardDescription>{headerCopy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as LoginTab)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="staff">Staff</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="join">Join</TabsTrigger>
              </TabsList>
              <TabsContent value="staff" className="mt-4">
                <form
                  onSubmit={handleStaffSubmit}
                  className="space-y-4"
                  autoComplete="off"
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="staff-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="staff-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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
              </TabsContent>
              <TabsContent value="customer" className="mt-4">
                <CustomerLoginForm embedded onJoinClick={() => setTab("join")} />
              </TabsContent>
              <TabsContent value="join" className="mt-4">
                <MemberRegistrationForm
                  embedded
                  onLoginClick={() => setTab("customer")}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
