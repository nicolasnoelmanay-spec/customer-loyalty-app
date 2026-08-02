"use client";

import { UserPlus } from "lucide-react";
import { RegistrationQrImage } from "@/components/qr/registration-qr-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RegistrationQrDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" className="w-full sm:w-auto" />}>
        <UserPlus className="size-4" />
        Member QR
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-1rem)] max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Member Registration QR
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-2">
          <RegistrationQrImage size={220} showDownload />
        </div>
      </DialogContent>
    </Dialog>
  );
}
