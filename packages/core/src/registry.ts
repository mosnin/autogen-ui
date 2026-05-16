import { Box, Icon, Image, Spacer } from "./components/box";
import { Checkbox, Form, Input, Select, Switch, Textarea } from "./components/forms";
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
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Form,
};

/** Merge custom components onto the defaults. Custom entries win on conflict. */
export function createRegistry(custom: ComponentRegistry = {}): ComponentRegistry {
  return { ...defaultRegistry, ...custom };
}
