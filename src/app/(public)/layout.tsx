import { dataMode, streamingMode } from "@/lib/env.server";
import { DevModeNotice } from "@/components/ui/DevModeNotice";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";

/**
 * Broadcast schedules and live state change constantly, so nothing on the
 * public site is prerendered at build time.
 */
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DevModeNotice dataMode={dataMode} streamingMode={streamingMode} />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
