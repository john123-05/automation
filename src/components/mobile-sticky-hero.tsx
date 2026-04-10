"use client";

import { useEffect, useState } from "react";

type MobileStickyHeroProps = {
  children: React.ReactNode;
};

export function MobileStickyHero({ children }: MobileStickyHeroProps) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setCompact(window.scrollY > 18);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className={`sticky top-2 z-30 origin-top transition-transform duration-200 ease-out sm:static sm:scale-100 ${
        compact
          ? "scale-[0.96] [&_[data-mobile-hero-shell]]:px-4 [&_[data-mobile-hero-shell]]:py-4 [&_[data-mobile-hero-title]]:text-[1.15rem] [&_[data-mobile-hero-title]]:leading-[1.02] [&_[data-mobile-hero-actions]]:mt-3"
          : "scale-100"
      }`}
    >
      {children}
    </div>
  );
}
