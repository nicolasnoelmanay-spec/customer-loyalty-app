"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { apiSendEmail } from "@/lib/api/loyalty-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/types";

interface SendCustomerEmailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SendCustomerEmailForm({
  customer,
  onOpenChange,
}: {
  customer: Customer;
  onOpenChange: (open: boolean) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      setError("Subject is required.");
      return;
    }
    if (!trimmedMessage) {
      setError("Message is required.");
      return;
    }

    setError("");
    setIsSending(true);
    try {
      await apiSendEmail({
        to: customer.email,
        subject: trimmedSubject,
        text: trimmedMessage,
        html: trimmedMessage
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>"),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Email Sent</DialogTitle>
          <DialogDescription>
            Your message was sent to {customer.name} at {customer.email}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mail className="size-5 text-emerald-600" />
          Send Email
        </DialogTitle>
        <DialogDescription>
          Send an email to {customer.name}.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="email-to">To</Label>
          <Input
            id="email-to"
            type="email"
            value={customer.email}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your loyalty points update"
            disabled={isSending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email-message">Message</Label>
          <Textarea
            id="email-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi Jane, ..."
            rows={6}
            disabled={isSending}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSending ? "Sending…" : "Send Email"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SendCustomerEmailDialog({
  customer,
  open,
  onOpenChange,
}: SendCustomerEmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {customer && (
          <SendCustomerEmailForm
            key={customer.id}
            customer={customer}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
