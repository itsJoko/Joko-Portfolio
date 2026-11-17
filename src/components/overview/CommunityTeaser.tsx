"use client";

import Link from "next/link";
import { useOnlineCount } from "@/lib/community/useOnlineCount";

/** "3 designing now" on the Overview: the live count from the Community page, as a way in. */
export function CommunityTeaser() {
  const online = useOnlineCount();
  return (
    <Link href="/community" data-section="community" className="link text-ink inline-flex items-center gap-2">
      {online ? (
        <>
          <span aria-hidden className="nav-live-dot" />
          {online} designing now
        </>
      ) : (
        "Community"
      )}
    </Link>
  );
}
