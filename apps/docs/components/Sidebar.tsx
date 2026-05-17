import Link from "next/link";

// Static nav. Each entry corresponds to one app/<slug>/page.tsx.
const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Start here",
    links: [
      { href: "/", label: "Overview" },
      { href: "/quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Spec",
    links: [
      { href: "/components", label: "Components" },
      { href: "/patches", label: "Patches" },
      { href: "/bindings", label: "Bindings" },
      { href: "/actions", label: "Actions" },
    ],
  },
  {
    title: "Runtime",
    links: [
      { href: "/forms", label: "Forms" },
      { href: "/data", label: "Data" },
      { href: "/streaming", label: "Streaming" },
    ],
  },
  {
    title: "Extending",
    links: [
      { href: "/custom-components", label: "Custom components" },
      { href: "/llm-clients", label: "LLM clients" },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-card/40 px-5 py-6 md:block">
      <Link href="/" className="block">
        <span className="text-lg font-bold tracking-tight">autogen-ui</span>
        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
          docs
        </span>
      </Link>

      <nav className="mt-8 flex flex-col gap-6 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="flex flex-col gap-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-2 py-1 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
