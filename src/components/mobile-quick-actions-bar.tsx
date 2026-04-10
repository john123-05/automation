"use client";

type MobileQuickActionsBarProps = {
  children: React.ReactNode;
};

export function MobileQuickActionsBar({ children }: MobileQuickActionsBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-3 z-40 lg:hidden">
      <div className="glass-panel pointer-events-auto rounded-[20px] px-2.5 py-2">
        <div className="flex items-center justify-center gap-1.5">{children}</div>
      </div>
    </div>
  );
}
