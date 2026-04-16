# Irie Builder Agent System

This document defines the agent architecture for Irie Builder as it evolves from a generator into a creative direction engine.

The goal is not to add agents for novelty.
The goal is to make the builder feel like a living creative team that helps shape a site with vision, psychology, motion, and taste.

## Product Intent

Irie Builder should not feel like a form that returns HTML.

It should feel like:
- a creative director shaping the page
- a strategist sequencing emotion
- an art director choosing the visual language
- a motion director controlling pace and reveals
- a critic reviewing whether the output actually hits

The product should stay simple on the surface while becoming deeper underneath.

The user experience should feel like:
1. describe the feeling
2. choose a direction or let the system choose
3. watch the creative team work
4. review the result
5. direct the next pass

## Design Principles

- Simple on the surface, deep underneath
- Agents should feel useful, not theatrical
- Each agent needs a clear job, not overlapping vague intelligence
- The system should explain why it made decisions
- Mobile experience must carry the same emotional force as desktop
- The builder should feel like it is directing, not randomly regenerating

## Core Agent Roles

### 1. Creative Director

Owns the overall vision for the page.

Responsibilities:
- set the emotional target
- determine the overall energy level
- keep the output aligned to the brief
- decide whether the page should feel restrained, cinematic, aggressive, warm, luxurious, raw, or playful
- coordinate the other agents into one coherent result

Outputs:
- creative thesis
- overall direction summary
- final pass framing

### 2. Brand Strategist

Owns positioning and audience framing.

Responsibilities:
- identify what the brand should mean on the page
- define the audience lens
- determine what should be believed by the middle of the page
- make sure the site is not just beautiful, but strategically clear

Outputs:
- audience lens
- positioning angle
- brand meaning statement

### 3. Brand Voice

Owns language, tone, and verbal identity.

Responsibilities:
- keep the copy real, human, and on-brand
- prevent generic AI marketing language
- make sure the tone feels lived-in and believable
- hold consistency across hero, story, CTA, and supporting sections

Outputs:
- tone profile
- copy guidance
- section-level voice notes

### 4. Psychology Director

Owns persuasion and emotional sequencing.

Responsibilities:
- control recognition, curiosity, desire, trust, and action
- place proof where hesitation happens
- delay or accelerate CTA timing based on emotional readiness
- reduce friction without flattening the page

Outputs:
- trust strategy
- proof placement strategy
- CTA timing strategy
- emotional sequencing plan

### 5. Art Director

Owns visual language.

Responsibilities:
- shape typography and composition
- define contrast, density, and whitespace behavior
- translate reference styles into original output
- decide how premium, raw, bold, polished, or editorial the page should look

Outputs:
- typography strategy
- layout rhythm
- palette strategy
- visual atmosphere summary

### 6. Motion Director

Owns movement and reveal behavior.

Responsibilities:
- define motion intensity
- shape scroll rhythm and transitions
- make motion feel meaningful, not decorative
- ensure the page feels alive

Outputs:
- motion intensity
- reveal behavior
- transition style
- atmosphere movement notes

### 7. Mobile Director

Owns mobile impact and handheld experience.

Responsibilities:
- make sure the first mobile viewport hits fast
- preserve the same emotional arc on smaller screens
- keep interactions thumb-friendly
- maintain clarity, pace, and desire on mobile

Outputs:
- mobile impact notes
- first-viewport strategy
- mobile simplification rules

### 8. Critic

Owns evaluation and creative pressure.

Responsibilities:
- review whether the output actually works
- identify what feels safe, weak, late, confusing, or forgettable
- compare passes and explain what improved
- challenge the system to push harder when needed

Outputs:
- verdict
- scorecard
- recommendations
- before/after change summary

## Support Agents

These can be added after the core group is working.

### Section Architect
- determines what sections exist
- assigns each section a job
- controls the order of the page

### Conversion Director
- optimizes action pressure, offer clarity, and friction removal
- focuses on the close and conversion moments

### Culture Translator
- helps culture-led brands feel authentic rather than corporate
- especially useful for streetwear, creator, event, music, and cannabis brands

### Reference Stylist
- translates design references like Nike, Apple, Vercel, Framer, Stripe, Notion, Spotify, and others
- avoids direct imitation

### Experience Editor
- handles direct revision passes like:
  - make the hero hit harder
  - move trust earlier
  - slow the page down
  - make it feel warmer

### Preview Judge
- reviews current vs previous generations
- summarizes what changed and whether it improved the experience

## Recommended Phase 1 User-Facing Agents

These are the six that should be visible first in the UI:
- Creative Director
- Brand Voice
- Psychology Director
- Art Director
- Motion Director
- Critic

Why these first:
- they are easiest for users to understand
- they map cleanly to what the builder already does
- they make the system feel alive without overwhelming the interface

## Recommended Phase 2 User-Facing Agents

Add these after Phase 1 is stable:
- Mobile Director
- Section Architect
- Reference Stylist
- Conversion Director

## Hidden vs Visible Agents

### Visible Agents

These should appear in the interface:
- Creative Director
- Brand Voice
- Psychology Director
- Art Director
- Motion Director
- Critic

Visible agents should:
- show status while generation is happening
- explain what they are doing in plain language
- help the user understand how the output is being shaped

### Hidden Agents

These can stay behind the scenes at first:
- Brand Strategist
- Section Architect
- Experience Editor
- Preview Judge
- Culture Translator
- Conversion Director

They can still influence generation without being exposed as UI elements immediately.

## UI Behavior

The UI should not feel like a dashboard of toggles.
It should feel like a creative room.

### During generation

Show active agent states like:
- Creative Director is shaping the overall page arc
- Psychology Director is placing trust and desire
- Art Director is choosing the visual rhythm
- Motion Director is setting reveal behavior
- Critic is preparing a post-pass review

### After generation

Show which agents most influenced the result:
- Creative Director: chose cinematic streetwear pacing
- Art Director: selected high-contrast serif + dark gold palette
- Psychology Director: delayed CTA until after proof
- Motion Director: raised reveal intensity to editorial
- Critic: flagged mobile impact as strong but trust timing slightly late

### Revision mode

Let the user direct the system in natural language:
- make the hero feel more dangerous
- add more warmth without losing tension
- move trust earlier
- make mobile hit harder

Then show which agent is taking the lead on that pass.

## Agent State Model

Each visible agent should support a simple lifecycle:
- idle
- planning
- shaping
- reviewing
- done

This can be represented in the UI without making the product feel busy.

## How This Maps to Existing Builder Systems

The builder already has many of the foundations:

- design direction engine -> Art Director + Reference Stylist
- psychology layer -> Psychology Director
- generation blueprint -> Creative Director + Brand Strategist + Section Architect
- emotional controls -> Creative Director + Psychology Director + Motion Director
- self-critique -> Critic
- carry-forward locks -> Experience Editor
- before/after compare -> Preview Judge
- mobile impact score -> Mobile Director

So this is not a net-new invention.
It is mostly a formalization and UI exposure of systems that already exist.

## Implementation Roadmap

### Phase 1

Goal:
Expose the system as a creative team without changing the generation architecture too much.

Tasks:
- define visible agent objects in code
- add agent status UI during generation
- attach current blueprint/critique outputs to named agents
- surface agent influence in the post-generation review

### Phase 2

Goal:
Let the user direct specific agents during revisions.

Tasks:
- route revision instructions to specific agents
- show which agent is leading the next pass
- let users emphasize one agent over another

Examples:
- let Motion Director lead
- make Critic stricter
- let Brand Voice soften the page

### Phase 3

Goal:
Move toward a true live creative system.

Tasks:
- stream generation progress as agent activity
- support multi-step passes
- support partial revisions without rebuilding everything
- potentially move long-running workflows to an agent-based backend process

## Tomorrow’s Working Plan

1. Create the agent definitions in code
2. Decide which agents are visible in the first UI pass
3. Add generation-state UI for active agents
4. Connect blueprint and critique data to specific agent cards
5. Add post-generation “who shaped this pass” summaries
6. Decide whether agent orchestration stays request-response or becomes a longer-lived process

## Success Criteria

This system is working when:
- the dashboard feels creative before generation starts
- the user understands who is shaping the page
- the output feels more intentional, not more complicated
- revisions feel like direction, not re-rolling
- mobile is treated as part of the main experience, not an afterthought
- the product feels like a creative intelligence engine, not a prettier template builder
