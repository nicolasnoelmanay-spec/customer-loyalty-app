"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Lock, Sparkles, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CustomerForgotPasswordForm } from "@/components/customer/customer-forgot-password-form";
import { CustomerLoginForm } from "@/components/customer/customer-login-form";
import { CustomerResetPasswordForm } from "@/components/customer/customer-reset-password-form";
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
  const [customerView, setCustomerView] = useState<"login" | "forgot">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const resetToken = searchParams.get("token")?.trim() ?? "";
  const isResetMode = searchParams.get("reset") === "1" && resetToken.length > 0;
  const isMemberApp =
    searchParams.get("app") === "member" ||
    (typeof navigator !== "undefined" &&
      /CoffeesentialsCustomerApp/i.test(navigator.userAgent));

  useEffect(() => {
    if (searchParams.get("join") === "1") {
      setTab("join");
    } else if (
      searchParams.get("customer") === "1" ||
      isResetMode ||
      isMemberApp
    ) {
      setTab("customer");
    }
    if (searchParams.get("forgot") === "1") {
      setCustomerView("forgot");
    }
  }, [searchParams, isResetMode, isMemberApp]);

  useEffect(() => {
    if (isMemberApp && tab === "staff") {
      setTab("customer");
    }
  }, [isMemberApp, tab]);

  useEffect(() => {
    // Member app must never bounce to the staff dashboard.
    if (isMemberApp) return;
    if (staffReady && staffAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isMemberApp, staffReady, staffAuthenticated, router]);

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

  // Staff sessions blank this page while redirecting — skip that in the member app.
  if (isMemberApp) {
    if (!customerReady || (customerAuthenticated && tab === "customer")) {
      return (
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      );
    }
  } else if (!staffReady || staffAuthenticated) {
    return null;
  }

  const headerCopy = isResetMode
    ? {
        title: "Reset Password",
        description: "Choose a new password for your member account.",
        icon: KeyRound,
      }
    : tab === "staff"
    ? {
        title: "Staff Login",
        description: `Sign in to access the ${loyaltyConfig.programName} dashboard.`,
        icon: Lock,
      }
    : tab === "customer"
      ? customerView === "forgot"
        ? {
            title: "Forgot Password",
            description: "We'll email you a link to reset your password.",
            icon: KeyRound,
          }
        : {
            title: "Member Login",
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
            {isResetMode ? (
              <CustomerResetPasswordForm token={resetToken} />
            ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (isMemberApp && value === "staff") return;
                setTab(value as LoginTab);
                if (value === "customer") {
                  setCustomerView("login");
                }
              }}
            >
              <TabsList
                className={
                  isMemberApp
                    ? "grid w-full grid-cols-2"
                    : "grid w-full grid-cols-3"
                }
              >
                {!isMemberApp && (
                  <TabsTrigger value="staff">Staff</TabsTrigger>
                )}
                <TabsTrigger value="customer">Member</TabsTrigger>
                <TabsTrigger value="join">Join</TabsTrigger>
              </TabsList>
              {!isMemberApp && (
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
              )}
              <TabsContent value="customer" className="mt-4">
                {customerView === "forgot" ? (
                  <CustomerForgotPasswordForm
                    embedded
                    onBackClick={() => setCustomerView("login")}
                  />
                ) : (
                  <CustomerLoginForm
                    embedded
                    onJoinClick={() => setTab("join")}
                    onForgotClick={() => setCustomerView("forgot")}
                  />
                )}
              </TabsContent>
              <TabsContent value="join" className="mt-4">
                <MemberRegistrationForm
                  embedded
                  onLoginClick={() => setTab("customer")}
                />
              </TabsContent>
            </Tabs>
            )}
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
