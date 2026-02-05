# Splat Library UI Design Guidelines

## Project Context
A 3D Gaussian Splatting platform where users upload videos to generate photorealistic 3D scenes. Target audience: developers, 3D artists, and technical creators.

## Visual & Aesthetic Requirements

### Typography
- **Display:** Space Grotesk (headings) - geometric, modern
- **Body:** IBM Plex Sans (UI text) - technical, readable
- **Mono:** JetBrains Mono (code, badges, data) - developer-friendly

### Color Palette: "Midnight Terminal"
IDE-inspired dark theme with vibrant accents:

```css
/* Surfaces */
--color-surface-base: #0a0e14;      /* Main background */
--color-surface-raised: #0f1419;    /* Cards, elevated elements */
--color-surface-overlay: #151b23;   /* Inputs, dropdowns */
--color-surface-border: #1e2530;    /* Borders, dividers */

/* Accents */
--color-accent-cyan: #39bae6;       /* Primary actions, links */
--color-accent-orange: #ff8f40;     /* Warnings, highlights */
--color-accent-green: #7fd962;      /* Success states */
--color-accent-purple: #d2a6ff;     /* Secondary accent */
--color-accent-red: #f07178;        /* Errors, destructive */
--color-accent-yellow: #e6b450;     /* Caution, tips */

/* Text */
--color-text-primary: #e6e6e6;      /* Main content */
--color-text-secondary: #8b949e;    /* Supporting text */
--color-text-muted: #565d67;        /* Disabled, hints */
```

### Motion & Animation
- **Page load:** Staggered fade-up reveals (0.1s delay increments)
- **Hover effects:** Subtle lift (-4px translateY) with border glow
- **Active states:** Glow pulse animation on processing elements
- **Transitions:** 200-300ms duration, ease-out timing

### Backgrounds
- Layered depth with radial gradient glow at top
- Subtle grid pattern (40px) for technical aesthetic
- Never use solid flat colors

## Technical Requirements

### Stack
- **Framework:** Vite + React 18 (not Next.js)
- **Styling:** Tailwind CSS v4 with `@theme` directive
- **Auth:** AWS Amplify UI React
- **State:** TanStack Query

### Tailwind v4 Specifics
- Define custom values in `@theme` block using CSS variables
- Use plain CSS for component classes (no `@apply` with custom classes)
- Animations defined with `--animate-*` variables and `@keyframes` in `@theme`

### Component Structure
```
src/
├── components/
│   ├── Layout/      # Header, Layout, Footer
│   ├── Gallery/     # SceneCard
│   ├── Upload/      # UploadForm, UploadProgress
│   └── Viewer/      # SplatViewer
├── pages/           # Route pages
├── hooks/           # Custom hooks
├── api/             # API client
└── styles/          # CSS files
```

### Component Patterns
- Use TypeScript interfaces for all props
- Include loading, error, and empty states
- Mobile-first responsive design
- Keyboard accessible with visible focus states

## UI Components

### Buttons
- `.btn-primary` - Cyan background, dark text, glow on hover
- `.btn-secondary` - Transparent with border, cyan on hover
- `.btn-ghost` - Text only, subtle background on hover

### Cards
- `.card` - Raised surface with border, backdrop blur
- `.card-hover` - Adds lift and glow on hover
- `.card-glow` - Permanent subtle glow effect

### Badges
- `.badge-success` - Green for ready/complete
- `.badge-warning` - Yellow for processing
- `.badge-error` - Red for failed
- `.badge-info` - Cyan for informational

### Form Elements
- Dark overlay background with border
- Cyan focus ring and border
- Placeholder text in muted color

## Design Principles

1. **Technical but approachable** - IDE aesthetic without being intimidating
2. **Information density** - Show relevant data (gaussian counts, timestamps)
3. **Progressive disclosure** - Tips and hints appear contextually
4. **Visual feedback** - Every interaction has clear response
5. **Accessibility** - High contrast, focus states, semantic HTML

## Avoid
- Generic AI aesthetics (purple gradients everywhere)
- Overused fonts (Inter, Roboto, Arial)
- Flat solid color backgrounds
- Missing loading/error states
- Low contrast text
