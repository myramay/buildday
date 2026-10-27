import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
          Patients
        </Link>
        <Link href="/test" className={buttonVariants({ variant: "outline" })}>
          New test
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
    </>
  );
}
