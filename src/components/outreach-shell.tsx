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
    <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
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
          <section className="glass-panel rounded-[34px] px-6 py-5 sm:px-7">
            <div className="lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href="/" className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-sm">
                    Back
                  </Link>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{title}</p>
                    {subtitle ? <p className="truncate text-sm text-slate-500">{subtitle}</p> : null}
                  </div>
                </div>
                <MobileDrawer title="Outreach navigation">
                  <div className="space-y-3">
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
                        {item.id === activeNav ? <span className="text-xs uppercase tracking-[0.18em]">Active</span> : null}
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

              <div className="mt-4 grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-[20px] border border-line bg-white/75 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{stat.value}</p>
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
