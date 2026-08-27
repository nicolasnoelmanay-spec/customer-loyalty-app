"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
      typeof window !== "undefined" &&
      sessionStorage.getItem("coffeesentials-member-registration-draft")
    ) {
      // Returning from privacy via history.back() may land on /login without join=1.
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
      }
    : tab === "staff"
    ? {
        title: "Staff Login",
        description: `Sign in to access the ${loyaltyConfig.programName} dashboard.`,
      }
    : tab === "customer"
      ? customerView === "forgot"
        ? {
            title: "Forgot Password",
            description: "We'll email you a link to reset your password.",
          }
        : {
            title: "Member Login",
            description: `Sign in with your member username and password.`,
          }
      : {
          title: "Member Registration",
          description: `Join ${loyaltyConfig.programName} to earn rewards on every visit.`,
        };

  return (
    <>
      <AppHeader active="login" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="relative mx-auto mb-4 flex size-28 items-center justify-center sm:mb-5 sm:size-32">
              <div
                aria-hidden
                className="absolute inset-2 rounded-full bg-amber-800/15 blur-2xl dark:bg-amber-400/20"
              />
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-100/40 to-transparent dark:from-amber-50/10"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- preserve logo alpha without image optimizer cache */}
              <img
                src="/coffeesentials-mark.png"
                alt="Coffeesentials"
                width={128}
                height={128}
                className="relative size-24 object-contain drop-shadow-[0_8px_24px_rgba(60,30,10,0.28)] animate-in fade-in zoom-in-95 duration-500 sm:size-28 dark:drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
              />
            </div>
            <CardTitle className="text-2xl tracking-tight">{headerCopy.title}</CardTitle>
            <CardDescription className="text-pretty">{headerCopy.description}</CardDescription>
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
