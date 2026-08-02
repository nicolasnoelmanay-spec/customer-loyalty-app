import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { sendEmail } from "@/lib/email/send-email";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const to = body.to;
    const subject = body.subject;
    const html = body.html;
    const text = body.text;
    const replyTo = body.replyTo;

    if (!to || (typeof to !== "string" && !Array.isArray(to))) {
      return jsonError("Recipient email (to) is required.", 400);
    }

    if (typeof subject !== "string" || !subject.trim()) {
      return jsonError("Email subject is required.", 400);
    }

    if (
      (typeof html !== "string" || !html.trim()) &&
      (typeof text !== "string" || !text.trim())
    ) {
      return jsonError("Email html or text content is required.", 400);
    }

    const result = await sendEmail({
      to,
      subject,
      html: typeof html === "string" ? html : undefined,
      text: typeof text === "string" ? text : undefined,
      replyTo: typeof replyTo === "string" ? replyTo : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Failed to send email.");
  }
}
