/**
 * Prompt-side deltas for the shadcn rendering target.
 *
 * The renderer maps spec `type`s onto shadcn/ui, but the *agent* also needs to
 * know two things the base catalog doesn't tell it: (1) the `Icon` component
 * now accepts the entire lucide-react set rather than eight names, and (2) it
 * should reach for the rich components instead of hand-building Box layouts.
 *
 * Pass `shadcnInstructions` as the agent's `instructions` option
 * (`createUIAgent`/`createStreamingUIAgent`) so this rides along in the system
 * prompt. It is additive — it does not replace the base catalog.
 */

/**
 * A curated set of common lucide names surfaced to the model. The `Icon`
 * component accepts any lucide name, but advertising a concrete list makes the
 * model reach for real, existing icons instead of inventing ones.
 */
export const advertisedIconNames: string[] = [
  // navigation / chrome
  "home", "search", "settings", "menu", "user", "users", "bell", "mail",
  "calendar", "clock", "filter", "more-horizontal", "more-vertical",
  // arrows / chevrons
  "chevron-right", "chevron-left", "chevron-down", "chevron-up",
  "arrow-right", "arrow-left", "arrow-up", "arrow-down", "external-link",
  // actions
  "plus", "minus", "check", "x", "edit", "trash", "copy", "save",
  "download", "upload", "share", "refresh-cw", "log-out", "log-in",
  // status / feedback
  "check-circle", "x-circle", "alert-circle", "alert-triangle", "info",
  "help-circle", "loader", "eye", "eye-off", "lock", "unlock", "shield",
  // commerce / metrics
  "credit-card", "dollar-sign", "shopping-cart", "package", "truck", "gift",
  "tag", "trending-up", "trending-down", "bar-chart", "pie-chart", "activity",
  "zap", "flame", "target", "award", "star", "heart", "bookmark", "flag",
  // content / files
  "file", "file-text", "folder", "image", "video", "music", "mic", "phone",
  "map-pin", "globe", "wifi", "cloud", "sun", "moon", "code", "terminal",
  // brands
  "github", "twitter", "linkedin", "slack", "figma", "chrome",
];

export const shadcnInstructions = `
## RENDERING TARGET: shadcn/ui
Your spec is rendered with shadcn/ui components and lucide-react icons, so the
props you already emit map straight onto native shadcn components. Prefer the
rich built-in components (Card, Stat, Table, Tabs, Accordion, Dialog/Modal,
Select, Switch, Badge, Avatar, Progress, Tooltip) over hand-building layouts
out of Box.

ICONS: the \`Icon\` component's \`name\` accepts ANY lucide-react icon (kebab-case),
not just a small built-in set. Reach for the precise icon a real designer would.
Reliable names include: ${advertisedIconNames.join(", ")}. If you need one not
listed, use the closest real lucide name (kebab-case).
`.trim();
