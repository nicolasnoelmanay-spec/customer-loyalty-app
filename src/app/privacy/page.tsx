import { Shield } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PrivacyBackToRegistration } from "@/components/privacy/privacy-back-to-registration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loyaltyConfig } from "@/config/loyalty";

const EFFECTIVE_DATE = "August 6, 2026";

export const metadata = {
  title: `Data Privacy Agreement | ${loyaltyConfig.programName}`,
  description:
    "How Coffeesentials collects, uses, and protects personal information under the Data Privacy Act of 2012 (RA 10173).",
};

export default function PrivacyPage() {
  const brandName = loyaltyConfig.email.brandName;
  const programName = loyaltyConfig.programName;
  const contactEmail = loyaltyConfig.email.fromAddress;

  return (
    <>
      <AppHeader active="login" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <Shield className="size-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Data Privacy Agreement</CardTitle>
              <CardDescription>
                {programName} · Philippines Data Privacy Act of 2012 (RA 10173)
              </CardDescription>
            </div>
            <p className="text-sm text-muted-foreground">
              Effective date: {EFFECTIVE_DATE}
            </p>
          </CardHeader>
          <CardContent className="space-y-8 text-sm leading-relaxed text-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold">1. Who we are</h2>
              <p className="text-muted-foreground">
                {brandName} operates the {programName} (the &quot;Program&quot;).
                This Data Privacy Agreement explains how we collect, use, store,
                and protect your personal information when you register for and
                use the Program. For privacy-related requests, contact us at{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  {contactEmail}
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                2. Personal information we collect at registration
              </h2>
              <p className="text-muted-foreground">
                When you create a member account, we collect the following
                personal information that you provide:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Full name</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>Username</li>
                <li>Password (stored as a secure hash, not in plain text)</li>
              </ul>
              <p className="text-muted-foreground">
                After registration, we may also process Program-related data
                linked to your account, including your member ID and QR code,
                loyalty points, vouchers, purchase and transaction history, and
                service communications such as welcome or password-reset emails.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                3. How we use your information
              </h2>
              <p className="text-muted-foreground">
                We use your personal information to:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Create and manage your membership account</li>
                <li>
                  Allow you to sign in with your username, email, or phone number
                </li>
                <li>
                  Award and track loyalty points, vouchers, and related rewards
                </li>
                <li>
                  Record and display purchase or transaction history for the
                  Program
                </li>
                <li>
                  Identify you at the counter through your member QR code
                </li>
                <li>
                  Send transactional emails needed to operate your account (for
                  example, welcome and password-reset messages)
                </li>
                <li>
                  Support customer service and Program operations by authorized
                  staff
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                4. Lawful basis and consent
              </h2>
              <p className="text-muted-foreground">
                Under the Data Privacy Act of 2012 (Republic Act No. 10173), we
                process your personal information based on your informed consent
                when you register for the Program and accept this Agreement. You
                may choose not to provide the required registration information;
                however, we will not be able to create a member account without
                it.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                5. Sharing and access
              </h2>
              <p className="text-muted-foreground">
                Authorized {brandName} staff may access member information as
                needed to operate the Program (for example, to look up your
                account, record purchases, or help with account support). We do
                not sell your personal information. We may use trusted service
                providers (such as hosting or email delivery) solely to operate
                the Program, and they process data only for that purpose.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                6. Storage and security
              </h2>
              <p className="text-muted-foreground">
                Your information is stored in a hosted database used by the
                Program. Passwords are stored as secure hashes and are not
                readable by staff. We take reasonable administrative and
                technical measures to protect personal information against
                unauthorized access, use, or disclosure. No method of electronic
                storage is completely secure, and we cannot guarantee absolute
                security.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">7. Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information while your membership is
                active and for as long as reasonably necessary to operate the
                Program, resolve disputes, and meet legal or operational
                requirements. If you ask us to delete your account, we will
                process the request subject to any records we must keep for
                legitimate Program or legal purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">
                8. Your rights under RA 10173
              </h2>
              <p className="text-muted-foreground">
                Subject to applicable law, you may request to:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Access the personal information we hold about you</li>
                <li>Correct inaccurate or incomplete personal information</li>
                <li>
                  Withdraw consent or request deletion of your membership data,
                  where applicable
                </li>
                <li>
                  Be informed about how your personal information is processed
                </li>
              </ul>
              <p className="text-muted-foreground">
                To exercise these rights, contact us using the email address
                below. We may need to verify your identity before fulfilling a
                request.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">9. How to contact us</h2>
              <p className="text-muted-foreground">
                For questions about this Agreement or to exercise your data
                privacy rights, email{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  {contactEmail}
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">10. Updates</h2>
              <p className="text-muted-foreground">
                We may update this Data Privacy Agreement from time to time. The
                effective date above shows when this version took effect. Continued
                use of the Program after an update constitutes acceptance of the
                revised Agreement, where permitted by law.
              </p>
            </section>

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                This notice is provided for transparency about Program
                registration data. It is not a substitute for formal legal advice.
              </p>
              <PrivacyBackToRegistration />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
