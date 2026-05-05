"use client";
import { usePathname } from "next/navigation";
import TopNav from "./TopNav";

// Hides the top nav on the login page so an unauthenticated visitor
// doesn't see fake navigation links that all redirect them back here.
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login";
  return (
    <>
      {!hideNav && <TopNav />}
      <main>{children}</main>
    </>
  );
}
