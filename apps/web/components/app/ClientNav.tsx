import Link from "next/link";

import { ClientAvatar } from "@/components/app/ClientsTable";
import type { ShopRoutes } from "@/lib/routes";

/** The clients as links, the open one marked: the list beside a client's file. */
export function ClientNav({ clients, currentId, routes }: { clients: { id: string; fullName: string }[]; currentId: string; routes: ShopRoutes }) {
  return (
    <ul className="flex flex-col p-1">
      {clients.map((c) => (
        <li key={c.id}>
          <Link
            href={routes.client(c.id)}
            aria-current={c.id === currentId ? "page" : undefined}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-fg outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold"
          >
            <ClientAvatar name={c.fullName} />
            <span className="truncate">{c.fullName}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
