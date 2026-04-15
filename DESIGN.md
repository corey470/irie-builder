# Design System: Irie Builder

## 1. Visual Theme & Atmosphere

Irie Builder is motion-first, creative, alive. It builds sites that feel alive — so the product page itself has to be the strongest demo. The entire experience is hand-authored vanilla CSS (no Tailwind, no component library) because the surface needs the kind of pixel-level motion craft that only direct CSS allows. The canvas is a near-black (`#080808`), almost obsidian, that lets light do all the talking. Gold (`#C9A84C`) moves through the design like firelight — in orb shapes that drift slowly across the viewport, in hairline borders that separate sections, in the headlines themselves.

The personality is editorial meets kinetic. Playfair Display sets the literary tone — a high-contrast didone serif with italic moments that feel carved into stone — while Syne handles the body: a geometric sans with enough quirk to avoid corporate flatness. Together they feel like a well-designed indie magazine that happens to animate.

Motion is the product. `orbFloat` drifts decorative gold blobs across backgrounds over 12-16s cycles. `stripScroll` marquees text across the viewport for 20s linear. `fadeUp` and `fadeDown` stagger hero content into view (eyebrow at 0.3s, title at 0.5s, sub at 0.8s, form at 1s) — every arrival is choreographed. A static SVG grain overlay (`0.5` opacity, `pointer-events: none`) sits over the entire experience, giving the black canvas a filmic, slightly degraded texture that reads as hand-made, not machine-output.

The custom cursor (gold 12px dot + 40px 1px ring, fine-pointer only) expands on interactive elements — another signal that this is a site where things respond.

**Key Characteristics:**
- Near-black canvas (`#080808`) with single gold accent (`#C9A84C`) and cream (`#F2EDE4`) body text
- Playfair Display (serif display) + Syne (geometric sans body) — indie editorial pairing
- Signature floating orbs: `orbFloat` 12-16s infinite, translate ±20-30px + scale 0.95-1.05
- Static SVG grain overlay at 0.5 opacity for filmic texture
- Staggered hero fade-up (eyebrow 0.3s, title 0.5s, sub 0.8s, form 1s)
- Marquee text strip (`stripScroll`, 20s linear) as a signature motion device
- Gold-dim backgrounds (`rgba(201, 168, 76, 0.15)`) for subtle section elevation
- Custom gold cursor on fine-pointer desktops — responsive, interactive feedback
- Subtle gold borders (`rgba(201, 168, 76, 0.18)`) as the entire divider system
- Vanilla CSS, no framework — motion and detail are hand-authored

## 2. Color Palette & Roles

### Core (CSS Custom Properties)
- **Black** (`--black: #080808`): Primary canvas. Near-obsidian; not pure black. The depth that makes gold glow.
- **Gold** (`--gold: #C9A84C`): Signature brand accent. Headlines (on hover), CTAs, orb glow, borders.
- **Gold Light** (`--gold-light: #E8C96A`): Higher-luminance gold for hover states and emphasized accents.
- **Gold Dim** (`--gold-dim: rgba(201, 168, 76, 0.15)`): Subtle gold-tinted backgrounds for elevated sections.
- **Cream** (`--cream: #F2EDE4`): Primary body text color. Warm off-white, easier on the eyes than pure white over black.
- **White** (`--white: #FAFAF7`): Accent text, hero emphasis, active states.
- **Muted** (`--muted: rgba(242, 237, 228, 0.45)`): Secondary text, meta copy, eyebrow labels.
- **Border** (`--border: rgba(201, 168, 76, 0.18)`): The only border treatment in the system — subtle gold hairlines.

### Responsive Padding Token
- **`--pad: clamp(1.25rem, 5vw, 3rem)`**: Fluid section padding — automatically scales with viewport without breakpoints.

### Gradients & Overlays
- Gold glow gradient: radial from gold-dim at center fading to transparent
- Grain overlay: static SVG noise filter, 0.5 opacity, mix-blend-mode overlay
- Text-shadow on headlines: `2px 2px 8px rgba(0, 0, 0, 0.8)` — deep drop-shadow for weight over orb backgrounds

## 3. Typography Rules

### Font Family
- **Display**: `Playfair Display` (weights 400, 700, 900, italic) loaded via Google Fonts `<link>` in `<head>`. Used for every headline, eyebrow caps, and editorial moments.
- **Body**: `Syne` (weights 300, 400, 500, 700) loaded via Google Fonts `<link>`. Used for body copy, buttons, nav, form inputs.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Display | Playfair Display | clamp(2.5rem, 9vw, 6rem) | 900 | 1 | -0.02em | Landing hero, maximum weight |
| Section Title | Playfair Display | clamp(1.8rem, 6vw, 3.5rem) | 700 | 1.1 | -0.01em | Section openers |
| H3 | Playfair Display | clamp(1.25rem, 3vw, 1.75rem) | 700 italic | 1.2 | normal | Step titles, feature names |
| Eyebrow | Syne | 12-13px | 500 | 1.4 | 0.2em (tracking-widest) | Uppercase section labels |
| Body | Syne | 16-18px | 400 | 1.6 | normal | Primary reading copy |
| Body Large | Syne | 20-22px | 300 | 1.5 | normal | Hero subtitle, lead paragraph |
| Meta | Syne | 13-14px | 400 | 1.5 | normal | Secondary copy, captions |
| Button | Syne | 14-15px | 500 | 1 | 0.02-0.05em | CTA buttons |
| Nav | Syne | 14px | 500 | 1 | 0.1em | Uppercase navigation links |

### Principles
- **Playfair for declarations**: headlines that want to feel authored, italic moments for personality
- **Syne for everything spoken**: copy that carries information — its geometric warmth balances Playfair's drama
- **Clamp() for fluid type**: every display size uses `clamp(min, vw, max)` so type scales continuously
- **Weight 900 on hero**: Playfair's heaviest weight is reserved for the landing hero headline — it's a single-use move
- **Wide tracking on eyebrows and nav**: 0.1-0.2em letter-spacing in uppercase Syne — the signature editorial label and navigation rhythm
- **Light weight 300 on lead copy**: Syne at 300 feels airy and confident for hero subtitles

## 4. Component Stylings

### Buttons

**Primary (Gold Fill)**
- Background: `var(--gold)` — `#C9A84C`
- Text: `var(--black)` — `#080808`
- Padding: `0.9rem 1.5rem` (~14px / 24px)
- Border: none
- Radius: 4-6px (tight, editorial)
- Font: Syne 14-15px weight 500, often uppercase with 0.02-0.05em tracking
- Hover: background shifts to `var(--gold-light)` (`#E8C96A`), subtle scale(1.02) or box-shadow gold glow
- Use: Primary waitlist CTA, "Start Building", "Get Access"

**Secondary (Outline Gold)**
- Background: transparent
- Text: `var(--gold)`
- Border: `1px solid var(--gold)`
- Padding: `0.9rem 1.5rem`
- Radius: 4-6px
- Hover: bg `var(--gold-dim)` (`rgba(201, 168, 76, 0.15)`), text stays gold
- Use: "Learn More", "View Demo"

**Ghost**
- Background: transparent
- Text: `var(--cream)` with hover to `var(--gold)`
- No border
- Underline or arrow slide on hover
- Use: Inline links, nav items

### Cards & Containers

**Feature Tile (grid cell)**
- Background: transparent
- Border: `1px solid var(--border)` (`rgba(201, 168, 76, 0.18)`) — the whole grid shares borders via 1px gap
- Padding: `var(--pad)` responsive, typically 2-3rem
- Hover: bg `rgba(201, 168, 76, 0.04)` — subtle gold wash

**Elevated Panel**
- Background: `var(--gold-dim)` (`rgba(201, 168, 76, 0.15)`)
- Border: `1px solid var(--border)`
- Radius: 8-12px
- Use: Highlighted feature callouts, testimonials

### Navigation

**Header**
- Background: transparent (sits over orbs), optionally `rgba(8, 8, 8, 0.6)` + backdrop-filter blur on scroll
- Logo: Playfair Display italic gold wordmark, left
- Nav links: Syne 14px weight 500 uppercase 0.1em tracking cream color
- CTA button right
- Height: ~80px

### Forms

**Input (Waitlist)**
- Background: transparent
- Text: `var(--cream)`
- Border: `1px solid var(--border)` (subtle gold hairline)
- Radius: 4-6px
- Padding: `0.9rem 1.25rem`
- Font: Syne 15-16px weight 400
- Placeholder: `var(--muted)` — `rgba(242, 237, 228, 0.45)`
- Focus: border shifts to `var(--gold)`, subtle gold glow outline

### Distinctive Components

**Floating Orbs**
- Absolute-positioned circular divs (120-320px diameter)
- Background: radial gradient `var(--gold-dim)` center → transparent edge
- Animation: `orbFloat` 12-16s infinite ease-in-out, translate(±20-30px, ±20-30px) + scale(0.95-1.05)
- `filter: blur(40-80px)` for soft edge diffusion
- Positioned behind content with z-index -1 or in decorative layers

**Marquee Text Strip**
- Full-viewport-width container with overflow hidden
- Inner span: `stripScroll` 20s linear infinite, `transform: translateX(-50%)` to loop
- Typography: Playfair Display italic, clamp(3rem, 10vw, 8rem), alternating cream/gold with bullet separators
- Use: hero transition moment, brand reinforcement strip

**Grain Overlay**
- Full-viewport fixed overlay, `pointer-events: none`
- Static SVG noise filter (feTurbulence + feColorMatrix)
- Opacity 0.5, mix-blend-mode: overlay
- `z-index: 9999` above content but non-interactive

**Custom Cursor**
- Fine-pointer only (`@media (pointer: fine)`)
- Dot: 12px gold, follows mouse via JS
- Ring: 40px, 1px solid gold, lerp-smoothed follow
- Hover on interactive: ring expands to ~60px, dot scales to 16px
- Disabled on touch / reduced motion

**Staggered Hero Entrance**
- Eyebrow: `fadeUp` 1s ease 0.3s
- Title: `fadeUp` 1s ease 0.5s
- Subtitle: `fadeUp` 1s ease 0.8s
- Form: `fadeUp` 1s ease 1s
- All move from `translateY(20px)` opacity 0 to final state

## 5. Layout Principles

### Spacing System
- Primary token: `--pad: clamp(1.25rem, 5vw, 3rem)` — responsive section padding
- Common scale: 0.5, 1, 1.5, 2, 3, 4, 6, 8rem
- Section vertical rhythm: `var(--pad) * 2` to `var(--pad) * 3` (≈ 80-160px at desktop)
- Gap in grids: 1px (so borders unify) or `var(--pad)` for breathing grids

### Grid & Container
- Max content width: 1200-1280px centered
- Hero: full viewport width, content constrained to max-width
- "For" grid: 2 columns × 2 rows with 1px gap (borders from adjacent cells)
- "Steps" grid: 4 columns with 1px gap or flex row
- Asymmetric editorial splits at `@media (min-width: 768px)`

### Whitespace Philosophy
- **Orbs replace decoration**: the negative space isn't empty — it's where the gold orbs drift
- **Responsive padding is fluid**: `clamp()` on `--pad` means the same token scales with viewport without breakpoints
- **1px gaps over visible dividers**: the 1px grid-gap technique lets borders emerge naturally between cells
- **Generous hero**: the landing viewport is claimed in full; content doesn't compete with the motion

### Border Radius Scale
- Sharp (0-2px): Most elements — editorial flatness
- Tight (4-6px): Buttons, inputs, small tiles
- Comfortable (8-12px): Elevated panels, feature cards
- Full: Orbs (circular), avatar moments

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Canvas (L0) | `#080808` bg with grain overlay | Default surface |
| Gold Hairline (L1) | `1px solid rgba(201, 168, 76, 0.18)` | Card borders, grid cells, inputs |
| Elevated Panel (L2) | `var(--gold-dim)` bg + hairline border | Highlighted feature tiles |
| Floating Orb | Radial gradient + 40-80px blur filter | Decorative atmospheric depth |
| Headline Weight | `text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.8)` | Hero headlines over orb backgrounds |
| Custom Cursor | Gold dot + ring with lerp-smoothed follow | Desktop interactive feedback |
| Grain Overlay | Fixed SVG noise at 0.5 opacity overlay blend | Filmic texture across entire surface |

**Shadow Philosophy**: There are almost no traditional drop shadows in the system. Depth is expressed through: (1) the grain overlay that gives everything a filmic layer, (2) blurred gold orbs that imply atmospheric depth, (3) subtle gold hairlines between cells, and (4) text-shadow on headlines to ensure legibility over moving backgrounds. The absence of drop shadows is itself a stylistic statement — this product doesn't rely on SaaS conventions.

## 7. Do's and Don'ts

### Do
- Use the near-black `#080808` canvas — not pure black, the slight lift makes gold glow
- Render every headline in Playfair Display; every body surface in Syne
- Apply `clamp()` to all display type — fluid scaling is the brand
- Let the gold orbs do the atmospheric work — position 2-4 per hero section with `orbFloat` animation
- Apply the grain overlay fixed across the viewport at 0.5 opacity
- Stagger hero entrance (eyebrow 0.3s → title 0.5s → sub 0.8s → form 1s)
- Use gold hairlines (`rgba(201, 168, 76, 0.18)`) as the only border treatment
- Enable the custom cursor on fine-pointer desktops only
- Respect `prefers-reduced-motion` — disable orbs, grain, stagger, cursor entirely

### Don't
- Don't use pure black or pure white — both are too harsh for this palette
- Don't introduce drop shadows — depth is through orbs, grain, and hairlines
- Don't use a component library or Tailwind — this is hand-authored CSS because the motion requires pixel craft
- Don't use typography other than Playfair Display + Syne
- Don't use font weights other than: Playfair 400/700/900/italic, Syne 300/400/500/700
- Don't animate faster than 0.6s for primary reveals — slow decay is the feel
- Don't show orbs without blur — the soft-diffusion is essential to their atmospheric role
- Don't run the grain overlay over interactive text without ensuring contrast
- Don't use traditional square cards — editorial flatness (0-6px radius) is the move
- Don't enable the custom cursor on touch devices

## 8. Responsive Behavior

### Breakpoints (Custom)
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single col, stacked hero, reduced orbs, hamburger nav |
| sm | 640-768px | Still single col, larger type |
| md | 768-1024px | 2-col editorial splits, 2-col "For" grid |
| lg | 1024-1200px | 4-col "Steps" grid, full nav |
| xl | ≥1200px | Max container, orbs more prominent, full motion |

### Touch Targets
- Primary CTA: 48px min height (`0.9rem` padding = ~14px + 16-18px text = ~48px)
- Nav links on mobile: 48-56px with generous tap area
- Form inputs: 48px min height on touch

### Collapsing Strategy
- Display type uses `clamp()` — fluid scaling, no breakpoint jumps
- Orbs reduce in count and size on mobile (2-3 instead of 4-6), opacity slightly lowered for performance
- Grain overlay opacity reduced to 0.3 on mobile to preserve text contrast
- Custom cursor disabled on coarse pointers
- Grid collapses: 4-col → 2-col → 1-col
- Hero stagger timings compress slightly on mobile (0.2s/0.4s/0.6s/0.8s)
- Marquee speed stays at 20s but can feel faster on smaller viewports — acceptable
- `prefers-reduced-motion`: disables orbs, grain, cursor, stagger, marquee entirely

## 9. Agent Prompt Guide

### Quick Color Reference
- Canvas: `#080808` (--black)
- Accent: `#C9A84C` (--gold)
- Accent bright: `#E8C96A` (--gold-light)
- Accent subtle bg: `rgba(201, 168, 76, 0.15)` (--gold-dim)
- Body text: `#F2EDE4` (--cream)
- Emphasis white: `#FAFAF7` (--white)
- Muted text: `rgba(242, 237, 228, 0.45)` (--muted)
- Border: `rgba(201, 168, 76, 0.18)` (--border)
- Responsive padding: `clamp(1.25rem, 5vw, 3rem)` (--pad)

### Example Component Prompts
- "Create an Irie Builder hero: bg `#080808` with 3 floating gold orbs (radial gradient `rgba(201,168,76,0.15)` → transparent, 200-300px, blur 60px, `orbFloat` 12-16s). Eyebrow in Syne uppercase 12px weight 500 tracking 0.2em cream, fadeUp 0.3s. Headline in Playfair Display weight 900 at `clamp(2.5rem, 9vw, 6rem)` line-height 1 letter-spacing -0.02em cream, fadeUp 0.5s, text-shadow `2px 2px 8px rgba(0,0,0,0.8)`. Subtitle Syne weight 300 at 20-22px muted, fadeUp 0.8s. Waitlist input + gold CTA button row, fadeUp 1s. Grain overlay fixed 0.5 opacity."
- "Design a waitlist form: flex row. Input: transparent bg, `1px solid rgba(201,168,76,0.18)` border, `0.9rem 1.25rem` padding, Syne 16px weight 400 cream text, placeholder muted, focus border gold. Button: gold `#C9A84C` bg, black text, Syne 14px weight 500 uppercase tracking 0.05em, `0.9rem 1.5rem` padding, hover bg `#E8C96A`."
- "Build a 'For' feature grid: 2 cols × 2 rows at md bp, 1px grid-gap (cells show borders naturally). Each cell: transparent bg, `var(--pad)` padding, Playfair italic title at `clamp(1.25rem, 3vw, 1.75rem)` weight 700, Syne body 16px weight 400 line-height 1.6 cream. Hover cell bg `rgba(201, 168, 76, 0.04)`."
- "Create a marquee strip: full-viewport overflow hidden. Inner span: Playfair Display italic clamp(3rem, 10vw, 8rem), text like 'CREATIVE · MOTION · CRAFT · ALIVE' alternating cream + gold with bullet separators. Animate `stripScroll`: 20s linear infinite, `transform: translateX(0) → translateX(-50%)`. Text duplicated for seamless loop."
- "Add the custom cursor: fine-pointer only. 12px gold dot `#C9A84C` follows mouse directly. 40px ring with 1px gold border lerp-smoothed (0.15 factor). On hover over `a, button, [data-hover]`, ring expands to 60px, dot scales to 16px. Disable on `prefers-reduced-motion` and coarse pointers."

### Iteration Guide
1. `#080808` canvas + `#C9A84C` gold + `#F2EDE4` cream — the three-color system, period
2. Playfair Display (serif drama) + Syne (geometric body) — no other fonts
3. `clamp()` on every display size — fluid typography is the brand
4. Orbs + grain + gold hairlines = the entire depth system — no drop shadows
5. Stagger the hero entrance: eyebrow 0.3s, title 0.5s, sub 0.8s, form 1s
6. The custom cursor is desktop-only and is a signature interactive feel
7. Vanilla CSS, hand-authored — this surface exists to demonstrate motion craft
8. `prefers-reduced-motion` disables everything decorative — orbs, grain, cursor, stagger
9. Editorial flatness on radii (0-6px) — no soft-SaaS rounded corners on primary elements

## 10. Mobile First Rules

Mobile is where real users are. Every page, every flow, every component is designed at 375px first and scales up. Desktop is a stretched mobile layout, not the primary target.

### Hard Rules
- **Design viewport starts at 375px.** Every component must look correct and be usable at 375px wide before any larger breakpoint is considered.
- **Touch targets minimum 44px.** All interactive elements — buttons, nav links, form controls, icon buttons — must present a 44×44px tap target. Pad small icon buttons with a transparent hit area if visual size must stay smaller.
- **No horizontal scroll, ever.** Pages must fit within viewport width at every breakpoint. The only exception is a deliberate horizontally-scrollable component (carousel, over-wide table) clipped inside its own container.
- **Full-width inputs and buttons on mobile.** Form fields and primary CTAs span the available content width on mobile. Never place two CTAs side-by-side on mobile — stack them vertically with the primary action on top.
- **Fluid typography via `clamp()`.** All hero and section headlines use `clamp(min, vw, max)` so type scales continuously without breakpoint jumps. Minimum body size is 16px on mobile (prevents iOS input zoom on focus).
- **Content never touches screen edges.** Minimum 16px (1rem) horizontal padding on every scrollable section. Use responsive padding tokens (`px-4 sm:px-6 lg:px-8` or `clamp(1rem, 5vw, 3rem)`).
- **Thumb-zone awareness.** On mobile, the primary CTA lives in the bottom third of the screen where the thumb naturally rests. Sticky bottom-bar CTAs are acceptable for checkout, booking, and purchase flows.
- **Modals go full-screen on mobile.** Dialogs smaller than the viewport are hard to read and harder to tap; drawer/sheet full-screen is the mobile default.
- **Navigation collapses to a hamburger or bottom bar on mobile.** Never truncate or cut off menu items. The opened menu is full-screen or a full-height drawer, with 48px+ tap rows.
- **Tables collapse or scroll.** Multi-column tables either wrap in an `overflow-x-auto` container or restructure as a stacked card list at `<sm`.
- **Images are responsive.** `max-width: 100%; height: auto` is the floor; serve appropriate sizes via `srcset` or `next/image`. Images never overflow their container.
- **Critical flows end-to-end on mobile.** Booking, checkout, signup, cart, and first-time-setup must all work flawlessly at 375px with no blocked interactions or clipped controls.

### Platform-Specific Mobile Priority
- **Transportation** — the booking form is the product. It must be flawless on a phone, end-to-end, from landing to confirmation.
- **Suite** — pipeline kanban, conversations inbox, approvals must all work on mobile with one-thumb navigation.
- **Commerce / Threads / Swag** — product grid → detail → cart → checkout must work end-to-end on 375px with no friction.
- **Builder** — preset buttons, toggles, color pickers must be tappable with a thumb, not requiring a mouse.

## 11. Psychology Layer

Every page is a conversation with a distracted human brain. These rules bake evidence-based conversion psychology into the default output.

### Attention & Motion
- **Motion captures attention before conscious thought.** Use scroll reveals, subtle parallax on hero, and gentle floating elements. The brain is wired to notice movement — use it with restraint and intent.
- **High-contrast elements draw the eye first.** Reserve the accent color on the canvas for headlines and primary CTAs only. Don't dilute it.
- **Z-pattern / F-pattern scanning.** The eye enters top-left and follows a Z on visual-heavy layouts or an F on text-heavy ones. Place the most important message top-left. Place the primary CTA where the eye naturally lands at the end of the pattern.

### Trust Building
- **Warm colors build trust; cool corporate blues feel distant.** Gold, amber, earth tones — the Irie palette — are trust-positive by default.
- **Social proof belongs directly before the CTA.** Testimonials at the bottom of a page convert worse than a single quote placed right above the button.
- **Specific numbers beat vague claims.** "312 orders this month" outperforms "hundreds of happy customers." "Used by 47 solo operators" beats "trusted by pros." Write specifics.
- **Consistency builds trust.** Every section feels like the same brand — same type system, same motion language, same palette. Inconsistency signals amateur.

### Decision Making & Conversion
- **Loss aversion > gain desire.** Frame benefits as what users won't lose. "Never miss a customer" > "get more customers." "Keep your inventory clean" > "better inventory management."
- **One primary CTA per section.** Never two equal options side-by-side — it creates decision paralysis. Use a visually-weighted primary + muted secondary only when both are genuinely needed.
- **Reduce friction relentlessly.** Every extra click, extra form field, extra choice loses users. Default to smart defaults; ask only what's essential.
- **Anchor high.** If showing pricing, lead with the higher-value option so the actual price feels reasonable by comparison.

### Reading Behavior
- **80% read only the headline.** The headline must carry the full message alone — if someone reads nothing else, they still understand what this is and why they should care.
- **Above the fold is worth 5× below the fold.** Most important message, clearest value prop, and primary CTA all visible before first scroll.
- **Short sentences get read; long blocks get skipped.** Maximum three sentences per paragraph.
- **Subheadings every 2–3 paragraphs.** People scan before they commit to reading.

### Mobile Psychology
- **The thumb rules.** Primary CTAs live in the bottom third of the mobile screen. Top-anchored navigation is fine; top-anchored primary CTAs are not.
- **Scroll is engagement.** Each scroll reveal on mobile is a micro-commitment. Use reveals to drip value instead of front-loading every message in a wall of text.
- **Speed is trust.** Every second of load time loses users. Above-the-fold content loads first; fonts preload; images are compressed and `loading="lazy"` for below-fold.

### Scarcity & Urgency
- **Only when true.** Fake urgency destroys trust permanently and immediately.
- **State scarcity plainly when real.** "12 left" at true stock. "Drop closes Sunday 11pm" at a real deadline. Never invent timers, never invent countdowns.
