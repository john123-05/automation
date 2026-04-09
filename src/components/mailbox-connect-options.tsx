import { GmailConnectButton } from "@/components/gmail-connect-button";
import { ManualMailboxConnectForm } from "@/components/manual-mailbox-connect-form";
import type { UiLanguage } from "@/lib/ui-settings-shared";

export function MailboxConnectOptions({ language = "en" }: { language?: UiLanguage }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-[28px] border border-line bg-white/80 p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Google Auth</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">
          {language === "de" ? "Gmail oder Workspace verbinden" : "Connect Gmail or Workspace"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {language === "de"
            ? "Öffnet Google OAuth im Browser. Ideal für Gmail und Google Workspace, inklusive nativer Gmail-Antwort-Synchronisation."
            : "Opens Google OAuth in the browser. Best for Gmail and Google Workspace mailboxes, plus native Gmail reply sync."}
        </p>
        <div className="mt-5">
          <GmailConnectButton language={language} />
        </div>
      </div>

      <ManualMailboxConnectForm language={language} />
    </div>
  );
}
