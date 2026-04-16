# Irie Builder

> A creative director engine that turns feeling into living websites.

Irie Builder is not trying to be another template picker or drag-and-drop site maker.

It is trying to become something new:
- a website builder with taste
- a generator with psychology built in
- a system that uses design direction, story arc, and motion to make pages people actually want to keep looking at

## What It Is

Irie Builder starts with:
- what you want someone to feel
- who the page is for
- what kind of page it is
- what visual direction should shape it

Then it generates:
- structure
- motion
- pacing
- copy
- atmosphere
- full HTML

The goal is not “a nice page.”

The goal is:
- a page that feels alive
- a page that makes someone stop
- a page that creates curiosity and momentum
- a page that feels art directed, not assembled

## The New Builder Brain

The repo now has three layers working together:

### 1. Emotional Brief
The user starts with feeling.

Examples:
- “Make it feel like a drop day”
- “Make it feel like a good book you can’t put down”
- “Make it feel premium but not corporate”

### 2. Design Direction Layer
Irie Builder can now work from reference directions inspired by:
- Nike
- Apple
- Vercel
- Stripe
- Framer
- Notion
- Spotify
- Linear
- Supabase
- Raycast
- Cursor
- Claude
- Airbnb
- Figma
- Runway
- SpaceX
- Uber
- Ferrari
- Lamborghini
- Pinterest
- Webflow
- or `Auto`, where the builder chooses the strongest fit

This is not for cloning.

It is for translating visual languages into original output:
- typography systems
- image treatment
- section pacing
- motion energy
- contrast and atmosphere

See [DESIGN_DIRECTIONS.md](/Users/coreysteward/irie-builder/DESIGN_DIRECTIONS.md).

### 3. Psychology Layer
Irie Builder now uses the Irie behavioral design rules as part of generation.

That means outputs should reflect:
- trust before ask
- momentum over friction
- specificity over generic “premium” copy
- recognition → curiosity → desire → trust → action
- proof at the moment of doubt
- motion as reward, not decoration

See [PSYCHOLOGY.md](/Users/coreysteward/irie-builder/PSYCHOLOGY.md).

### 4. Generation Blueprint Layer
Before HTML is generated, Irie Builder now creates a structured blueprint for:
- brand core
- story arc
- design system
- motion system
- persuasion system
- section plan

That blueprint is then used to generate the final site, so the builder is starting to think in systems instead of jumping straight to markup.

### 5. Emotional Control + Self-Critique
Irie Builder can now be pushed with emotional weights:
- authority
- desire
- warmth
- tension
- spectacle

After generation, it can also critique itself across:
- first-impression power
- emotional clarity
- trust timing
- visual distinctiveness
- motion readiness
- conversion pressure

### 6. Directing Pass
The builder can now take a focused creative note for the next pass:
- whole page
- hero
- story
- trust layer
- CTA close
- motion system
- conversion pressure

So revisions can behave more like art direction and less like starting over.

### 7. Before / After Comparison
Every new pass can now keep the last generation around as a visual reference.
That makes it possible to compare:
- before / after
- old critique / new critique
- old direction / new direction

So the builder can evolve work instead of constantly replacing it.

### 8. Mobile-First Emotional Impact
Mobile is not treated like a fallback viewport.
The builder now explicitly aims for:
- a decisive first mobile viewport
- compressed but intact story arc
- tactile motion
- thumb-friendly interaction
- premium rhythm on small screens

### 9. Pass History + Viewport Preview
The builder can now preserve recent passes and compare work in motion:
- before / after side by side
- mobile or desktop preview mode
- recent pass labels with critique verdicts

So changes feel like directed evolution instead of disappearing every time you regenerate.

### 10. Selective Carry-Forward
You can now lock strong systems between passes, like:
- hero
- story arc
- trust layer
- CTA close
- motion system
- design system

So the next generation can evolve around what is already working instead of replacing everything.

### 11. Change Summaries
The builder can now describe what actually changed between passes:
- what improved
- what shifted
- what got stronger

So the output has memory and narrative, not just versions.

### 12. Dashboard Experience Upgrade
The dashboard has been pushed closer to the product vision instead of staying a plain utility shell.

It now includes:
- a stronger creative-director left rail
- a staged preview area that feels more intentional
- a visible desktop-to-phone preview relationship
- clearer blueprint / critique framing in the right rail

The goal is:
- homepage = fire
- dashboard = the blaze
- generated output = the volcano

### 13. Production Stability Fix
The generation route was tightened for production reliability.

The key fix:
- remove the extra live blueprint model call from the request path

That keeps the production `/api/generate` route from timing out as easily under Vercel’s serverless runtime limits, while still preserving the builder’s blueprint-driven behavior through the deterministic planning layer.

## What Makes It Different

| Typical builder | Irie Builder |
|---|---|
| Starts from layout | Starts from feeling |
| Gives templates | Makes creative decisions |
| Generic copy | Brand-shaped copy |
| Motion as decoration | Motion as story and momentum |
| One visual lane | Multiple design directions |
| Static sections | Story-driven pacing |

## Current Product Direction

The long-term vision is:

Irie Builder becomes a **creative director engine** that can generate bold, emotionally-paced, psychologically-aware websites across industries.

That includes:
- streetwear
- luxury
- restaurants
- events
- SaaS
- creator brands
- editorial pages

Streetwear is a major proving ground, but the system is meant to be versatile.

## Current UI Capabilities

Inside the dashboard, the builder now supports:
- brief-first generation
- chat-guided generation
- mood selection
- page-type selection
- color overrides
- design-direction selection
- multi-select reference-style library
- emotional control sliders
- directing-pass controls
- before / after compare mode
- mobile-first impact rules in the generation engine
- mobile / desktop preview toggle
- pass history in the builder rail
- carry-forward locks for strong sections and systems
- change summaries between passes
- optional style blending
- visible generation blueprint
- self-critique scoring
- live iframe preview
- visible creative decisions log

## How The Builder Thinks

At generation time, the system now combines:
1. brand brief
2. audience
3. mood
4. page type
5. design direction
6. psychology rules
7. motion vocabulary

So the output is no longer just “HTML from a prompt.”

It is meant to feel like:
- a creative director chose the angle
- a motion designer shaped the pacing
- a behavioral strategist placed the proof and CTAs
- a builder assembled the final experience

## Agent Architecture

The long-term product is not just “AI that returns a website.”

It is moving toward an internal creative team model.

Documented here:
- [AGENT_SYSTEM.md](/Users/coreysteward/irie-builder/AGENT_SYSTEM.md)

Core internal roles:
- Creative Director
- Brand Strategist
- Brand Voice
- Psychology Director
- Art Director
- Motion Director
- Mobile Director
- Critic

These are intended to make the builder feel like a creative intelligence engine instead of a prompt box.

## Roadmap

### Near-term
- Expand the design-direction library
- Add multi-direction blending with stronger UI
- Add industry-specific story-arc logic
- Improve the preview and export workflow
- Expose named internal agents in the dashboard UI

### Mid-term
- Build section-level regeneration
- Add brand memory and reusable visual systems
- Add better deployment flow to live URLs
- Add reusable output scoring from a reality-check layer
- Add agent-led generation states and revision ownership

### Long-term
- Make the builder feel less like prompting and more like directing a living design system
- Build sites that unfold like stories
- Make motion, proof placement, and copy behavior feel intentional and persuasive
- Create a new category: emotionally intelligent website generation
- Turn the builder into a visible creative team, not an invisible one-shot generator

## North Star

> Like a good book you can’t put down — where every scroll reveals something new, and the story just keeps getting better.

That is still the test.

If a generation does not create:
- feeling
- momentum
- curiosity
- desire
- trust
- action

then it is not done yet.
