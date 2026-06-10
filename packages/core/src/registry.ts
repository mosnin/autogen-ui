import { Box, Icon, Image, Outlet, Spacer } from "./components/box";
import { Checkbox, Form, Input, Select, Switch, Textarea } from "./components/forms";
import { Avatar, CodeBlock, Kbd, Quote, Skeleton } from "./components/media";
import { Accordion, Breadcrumb, Link, Tabs } from "./components/navigation";
import { Modal, Tooltip } from "./components/overlays";
import {
  Badge,
  Button,
  Card,
  Chart,
  Divider,
  Grid,
  Heading,
  List,
  Progress,
  Section,
  Stack,
  Stat,
  Table,
  Text,
} from "./components/primitives";
import type { ComponentRegistry } from "./components/types";

/** Machine-readable description of one component, fed into the system prompt. */
export interface ComponentDoc {
  type: string;
  description: string;
  props: string;
  acceptsChildren: boolean;
}

/**
 * The catalog the model is allowed to draw from. Keep this in sync with
 * `defaultRegistry` — it is the contract between the model and the runtime.
 */
export const componentCatalog: ComponentDoc[] = [
  {
    type: "Grid",
    description: "Responsive 12-column grid. The dashboard root should usually be a Grid.",
    props: "gap?: 0|1|2|3|4|6|8",
    acceptsChildren: true,
  },
  {
    type: "Stack",
    description: "Flex stack for grouping nodes vertically or horizontally.",
    props: "direction?: 'row'|'col', gap?: number, align?: 'start'|'center'|'end'",
    acceptsChildren: true,
  },
  {
    type: "Section",
    description: "Full-width titled section header with children below it.",
    props: "title?: string, description?: string",
    acceptsChildren: true,
  },
  {
    type: "Card",
    description: "Bordered container with optional title/description. Size it with `span`.",
    props: "title?: string, description?: string, span?: 1-12 (grid columns, default 4)",
    acceptsChildren: true,
  },
  {
    type: "Stat",
    description: "KPI tile: a label, a big value, and an optional delta with trend color.",
    props:
      "label: string, value: string|number, delta?: string, trend?: 'up'|'down'|'flat', span?: 1-12 (default 3)",
    acceptsChildren: false,
  },
  {
    type: "Chart",
    description: "Dependency-free SVG chart. Animates on mount and on data change.",
    props:
      "kind: 'bar'|'line'|'area', data: {label:string,value:number}[], title?: string, span?: 1-12 (default 6)",
    acceptsChildren: false,
  },
  {
    type: "Table",
    description: "Data table.",
    props: "columns: string[], rows: (string|number)[][]",
    acceptsChildren: false,
  },
  {
    type: "Heading",
    description: "Section heading.",
    props: "text: string, level?: 1|2|3",
    acceptsChildren: false,
  },
  {
    type: "Text",
    description: "Paragraph of body text.",
    props: "text: string, muted?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Badge",
    description: "Small status pill.",
    props: "label: string, variant?: 'default'|'secondary'|'success'|'warning'|'danger'|'outline'",
    acceptsChildren: false,
  },
  {
    type: "Button",
    description: "Presentational button (no side effects wired).",
    props: "label: string, variant?: 'default'|'secondary'|'outline'|'ghost'",
    acceptsChildren: false,
  },
  {
    type: "Progress",
    description: "Horizontal progress bar.",
    props: "label?: string, value: number (0-100)",
    acceptsChildren: false,
  },
  {
    type: "List",
    description: "Bulleted or numbered list.",
    props: "items: string[], ordered?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Divider",
    description: "Full-width horizontal rule.",
    props: "(none)",
    acceptsChildren: false,
  },
  {
    type: "Box",
    description:
      "Generic container. Carries no styling of its own — drive layout/visuals via the node's `style`. Use it to build novel layouts.",
    props: "as?: 'div'|'section'|'article'|'header'|'footer'|'nav'|'aside'|'main'",
    acceptsChildren: true,
  },
  {
    type: "Image",
    description: "Image rendered with object-cover.",
    props:
      "src: string, alt?: string, rounded?: 'none'|'sm'|'md'|'lg'|'xl'|'2xl'|'full', aspect?: 'auto'|'square'|'video'",
    acceptsChildren: false,
  },
  {
    type: "Icon",
    description: "Inline SVG icon from a small built-in set.",
    props:
      "name: 'check'|'x'|'arrow-up'|'arrow-down'|'star'|'bolt'|'dot'|'chevron-right', size?: number (px, default 16)",
    acceptsChildren: false,
  },
  {
    type: "Spacer",
    description: "Flexible spacer that absorbs free space inside a flex container.",
    props: "(none)",
    acceptsChildren: false,
  },
  {
    type: "Outlet",
    description:
      "Placeholder for the active screen inside `dashboard.layout`. Put one Outlet anywhere in the layout tree (e.g. next to a Sidebar). The renderer swaps it for the current screen's root on every navigation.",
    props: "(none)",
    acceptsChildren: false,
  },
  {
    type: "ForEach",
    description:
      "Repeats its first child once per item in `source`. Inside the template, bindings can reference `{{<as>.X}}` (default `as` is \"item\") and the loop index via `{{<indexAs>}}` (default \"i\"). Events on the template are rewritten with concrete per-iteration values at expansion time.",
    props:
      "source: string (a binding-style path like 'data.items' or 'state.cart'), as?: string (default 'item'), indexAs?: string (default 'i')",
    acceptsChildren: true,
  },
  {
    type: "Input",
    description:
      "Text input. Wire `events.onChange` with a setState action that reads `{{event.value}}` to drive state. Bind `value` to that same state for a controlled input.",
    props: "type?: 'text'|'number'|'email'|'password'|'search'|'url'|'tel', placeholder?: string, value?: string|number",
    acceptsChildren: false,
  },
  {
    type: "Textarea",
    description: "Multi-line text input. Same event/value model as Input.",
    props: "placeholder?: string, value?: string, rows?: number",
    acceptsChildren: false,
  },
  {
    type: "Select",
    description: "Dropdown select. `onChange` fires with `{{event.value}}` set to the chosen option's value.",
    props: "options: ({value:string|number,label?:string}|string|number)[], value?: string|number, placeholder?: string",
    acceptsChildren: false,
  },
  {
    type: "Checkbox",
    description: "Boolean checkbox. `onChange` fires with `{{event.value}}` = the next boolean state.",
    props: "label?: string, checked?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Switch",
    description: "Toggle switch (same model as Checkbox, different look).",
    props: "label?: string, checked?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Form",
    description:
      "Form container. `onSubmit` fires with `{{event.values}}` = a record of named field values from inner inputs that carry a DOM `name`.",
    props: "(none)",
    acceptsChildren: true,
  },
  {
    type: "Tabs",
    description:
      "Tabbed container. Child at index N corresponds to tabs[N]. Bind `value` to state and wire `onChange` with `{{event.value}}` to switch the active tab.",
    props: "tabs: {value:string,label:string}[], value?: string",
    acceptsChildren: true,
  },
  {
    type: "Accordion",
    description:
      "Collapsible sections. Child at index N maps to items[N]. Bind `openValues` to a string[] in state and wire `onChange` with a toggleState action driven by `{{event.value}}`.",
    props: "items: {value:string,label:string}[], openValues?: string[]",
    acceptsChildren: true,
  },
  {
    type: "Link",
    description: "Anchor link. Opens in a new tab when `newTab` is true.",
    props: "href: string, text: string, newTab?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Breadcrumb",
    description: "Breadcrumb trail. Last item is plain text, earlier items are links if `href` is set.",
    props: "items: {label:string, href?:string}[]",
    acceptsChildren: false,
  },
  {
    type: "Modal",
    description:
      "Dialog overlay. Bind `open` to a boolean in state to show/hide. Wire `onClose` to a setState/toggleState action to dismiss when the backdrop or close button is clicked.",
    props: "open?: boolean, title?: string",
    acceptsChildren: true,
  },
  {
    type: "Tooltip",
    description: "Wraps a child and shows a small dark popover with `text` on hover.",
    props: "text: string, side?: 'top'|'bottom'|'left'|'right'",
    acceptsChildren: true,
  },
  {
    type: "Avatar",
    description:
      "User avatar. Shows the image at `src`, or falls back to initials from `name`. Optional online indicator.",
    props: "src?: string, name?: string, size?: 'sm'|'md'|'lg'|'xl', online?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Skeleton",
    description: "Animated placeholder bars used while content is loading.",
    props: "lines?: number (default 1), height?: 'sm'|'md'|'lg'",
    acceptsChildren: false,
  },
  {
    type: "CodeBlock",
    description: "Monospaced code block with a language pill in the top-right (label only, no highlighting).",
    props: "code: string, language?: string",
    acceptsChildren: false,
  },
  {
    type: "Quote",
    description: "Left-bordered blockquote with optional author footer.",
    props: "text: string, author?: string",
    acceptsChildren: false,
  },
  {
    type: "Kbd",
    description: "Inline keyboard hint, e.g. '⌘ + K' or 'Ctrl + S'. Splits on '+'.",
    props: "keys: string",
    acceptsChildren: false,
  },
];

/** Built-in component registry mapping spec `type` -> React component. */
export const defaultRegistry: ComponentRegistry = {
  Grid,
  Stack,
  Section,
  Card,
  Stat,
  Chart,
  Table,
  Heading,
  Text,
  Badge,
  Button,
  Progress,
  List,
  Divider,
  Box,
  Image,
  Icon,
  Spacer,
  Outlet,
  // ForEach resolves to Box before render; reuse Box as the renderer.
  ForEach: Box,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Form,
  Tabs,
  Accordion,
  Link,
  Breadcrumb,
  Modal,
  Tooltip,
  Avatar,
  Skeleton,
  CodeBlock,
  Quote,
  Kbd,
};

/** Merge custom components onto the defaults. Custom entries win on conflict. */
export function createRegistry(custom: ComponentRegistry = {}): ComponentRegistry {
  return { ...defaultRegistry, ...custom };
}
