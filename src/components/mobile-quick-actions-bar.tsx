"use client";

type MobileQuickActionsBarProps = {
  children: React.ReactNode;
};

export function MobileQuickActionsBar({ children }: MobileQuickActionsBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 lg:hidden">
      <div className="glass-panel pointer-events-auto rounded-[24px] px-3 py-3">
        <div className="flex items-center justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}
