import Link from "next/link";
import type { ReactNode } from "react";
import { MobileDrawer } from "@/components/mobile-drawer";
import { OutreachSidebar } from "@/components/outreach-sidebar";

type NavItemId = "campaigns" | "setup" | "templates" | "mailboxes" | "inbox";

const navItems: Array<{
  id: NavItemId;
  label: string;
  shortLabel: string;
  href: string;
}> = [
  { id: "campaigns", label: "Campaigns", shortLabel: "C", href: "/outreach" },
  { id: "setup", label: "Setup", shortLabel: "A", href: "/outreach/setup" },
  { id: "templates", label: "Templates", shortLabel: "T", href: "/outreach/templates" },
  { id: "mailboxes", label: "Mailboxes", shortLabel: "M", href: "/outreach/mailboxes" },
  { id: "inbox", label: "Inbox", shortLabel: "I", href: "/outreach/inbox" },
];

export function OutreachShell({
  activeNav,
  title,
  subtitle,
  stats,
  children,
}: {
  activeNav: NavItemId;
  title: string;
  subtitle?: string | null;
  stats: Array<{ label: string; value: string }>;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1680px] overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)]">
        <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
          <OutreachSidebar
            items={navItems.map((item) => ({
              ...item,
              active: item.id === activeNav,
            }))}
            workspaceHref="/workspace"
          />
        </aside>

        <div className="space-y-6">
          <section className="glass-panel rounded-[28px] px-4 py-4 sm:rounded-[34px] sm:px-6 sm:py-5 sm:px-7">
            <div className="lg:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[1rem] font-semibold leading-tight text-slate-900">
                    {title}
                  </p>
                  {subtitle ? <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p> : null}
                </div>
                <div className="shrink-0">
                  <MobileDrawer title="Outreach navigation">
                    <div className="space-y-3">
                      <Link
                        href="/"
                        className="flex items-center justify-between rounded-[20px] border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                      >
                        <span>Back to dashboard</span>
                      </Link>
                      {navItems.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`flex items-center justify-between rounded-[20px] border px-4 py-3 text-sm font-medium transition ${
                            item.id === activeNav
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-line bg-white text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <span>{item.label}</span>
                          {item.id === activeNav ? (
                            <span className="text-xs uppercase tracking-[0.18em]">Active</span>
                          ) : null}
                        </Link>
                      ))}
                      <Link
                        href="/workspace"
                        className="flex items-center justify-between rounded-[20px] border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                      >
                        <span>Workspace</span>
                      </Link>
                    </div>
                  </MobileDrawer>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/75 px-3 py-1.5 text-[11px] font-medium text-slate-900"
                >
                  Back
                </Link>
                <Link
                  href="/workspace"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/75 px-3 py-1.5 text-[11px] font-medium text-slate-900"
                >
                  Workspace
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-[18px] border border-line bg-white/75 px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-slate-950">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden flex-wrap items-center gap-4 text-sm text-slate-500 lg:flex">
              <Link href="/" className="rounded-full border border-line bg-white/70 px-3 py-1.5">
                Back
              </Link>
              <span className="font-semibold text-slate-900">{title}</span>
              {subtitle ? <span className="text-slate-500">{subtitle}</span> : null}
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-4">
                  <span className="hidden h-8 w-px bg-line md:block" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {children}
        </div>
      </div>
    </main>
  );
}
