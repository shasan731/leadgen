import Link from "next/link";

export function safeHref(href?: string | null) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? href : null;
  } catch {
    return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null;
  }
}

export function SafeLink({
  href,
  children,
  className,
  external
}: {
  href?: string | null;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  const safe = safeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  if (external || /^https?:/.test(safe)) {
    return (
      <a href={safe} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={safe} className={className}>
      {children}
    </Link>
  );
}
