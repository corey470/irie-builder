# AGENTS.md — Irie Experience Builder

## Core Agents

### Creative Director Agent
Responsible for interpreting the emotional brief and making top-level creative decisions.
- Input: emotional brief ("what do you want someone to feel?")
- Output: story arc, section order, visual direction, motion vocabulary
- Does NOT generate copy or code — directs the other agents

### Brand Voice Agent
Reads brand voice from Irie OS shared memory and ensures every word sounds like the brand.
- Input: brand voice profile, campaign context
- Output: headlines, body copy, CTAs, micro-copy
- Connected to: Brand Voice Module

### Motion Architect Agent
Designs the scroll experience — what happens when, in what order, with what timing.
- Input: story arc from Creative Director, section content
- Output: animation choreography, scroll triggers, transition specs
- Produces: CSS animations, JS scroll behavior, motion tokens

### Visual Atmosphere Agent
Sets the color temperature, typography weight, spatial composition.
- Input: emotional brief, brand colors, mood
- Output: color palette, font pairing, spacing system, texture decisions
- Connected to: store brand data

### Builder Agent
Assembles the full HTML/CSS/JS experience from all agent outputs.
- Input: copy, motion specs, visual system, section order
- Output: complete deployable web experience
- Deploys to: brand URL via Irie OS

### Reality Checker Agent
Verifies the output actually feels like what was briefed.
- Input: completed experience, original emotional brief
- Output: pass/fail + specific notes on what to adjust
- Gate: nothing ships without Reality Checker sign-off
