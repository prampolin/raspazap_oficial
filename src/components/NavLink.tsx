"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, type ComponentProps } from "react";
type NavLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string | ((isActive: boolean) => string);
  end?: boolean;
};

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, href, end, ...props }, ref) => {
    const pathname = usePathname();
    const hrefStr = typeof href === "string" ? href : href.pathname ?? "";
    const isActive = end ? pathname === hrefStr : pathname.startsWith(hrefStr);

    return (
      <Link
        ref={ref}
        href={href}
        className={typeof className === "function" ? className(isActive) : className}
        data-active={isActive ? "" : undefined}
        {...props}
      />
    );
  },
);
NavLink.displayName = "NavLink";

export { NavLink };
