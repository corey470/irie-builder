# Drag-to-Nudge — Scoping Analysis + Recommendation

_Scoping pass, not a build. Written against `main` at commit `030e1a0` (post-Tuner-v2 + footer/CTA fixes). Corey reads this and decides: build drag as spec'd, build a lighter alternative, or punt._

## The ask, restated

When working in a section, the user should be able to grab a text element in the preview iframe and move it within its section. Example: grab the hero headline, nudge it down-and-left, leave the rest of the page untouched. Not free-position. Not cross-section reorder. Just shift within the current layout while the rest reflows naturally.

Before answering _how_, this doc examines _whether_ drag-as-pointer-gesture is the right interaction at all, given the product's mobile-first constraint and what the Tuner already has.

---

## 1. Interaction model

The live preview iframe already absorbs click events for section/text/image/marquee selection via `app/_components/tuner/TunerEditor.tsx` click dispatch into `classifyClickTarget` in `lib/tuner/selection.ts`. Adding a mousedown-move-up gesture on top of that click flow is viable but introduces real distinguishing burden — every click needs to be disambiguated from "click to select" vs "drag to nudge."

The cleanest initiation pattern: a **dedicated drag handle that appears only in Object Mode Text**. When the user clicks a text element and enters Object Mode, we paint a 4-way arrow chip in one corner of the gold selection ring. Grabbing that chip (mousedown on the chip itself, not the text) starts a drag. Anywhere else is a normal click. This matches how Figma, Framer, and Webflow Designer all solve the same ambiguity.

A long-press would work but is unfamiliar on desktop and collides with contextmenu on right-click-capable mice. A keyboard modifier (⌥-drag, ⇧-drag) would work for power users but is invisible to first-timers. The handle chip is discoverable and unambiguous.

**Drop affordance.** Two cheap, useful, not-over-engineered signals:
1. A faint dashed outline inside the section showing the safe-drop zone (the section's padding rectangle). The element cannot leave that rectangle; attempting to drag past snaps to the edge.
2. A tiny HUD readout near the cursor showing the live offset in the chosen unit (`+24, −12` or `0.5em, -0.25em`). Without it, the drag feels guessy.

No snap guides, no baseline grid, no rulers. That's Figma territory and overkills an "nudge the headline down" affordance.

**Active-drag signal.** The gold selection ring thickens from 2px to 3px and the element gets `cursor: grabbing`. Other sections fade to 60% opacity so the user's focus stays inside the active section. Drop restores everything.

**Mobile.** Touch devices are where this gets ugly. Fingers on a scrollable iframe are already ambiguous (scroll vs drag vs tap), and adding a fourth gesture (long-press-then-drag on a handle) pushes users past patience. **My position: drag is desktop-only.** Mobile gets the same nudge controls exposed as sliders in the Object Mode Text panel instead. This matches Corey's existing mobile-quiet Tuner pattern where precision controls live in the right panel, not on the canvas.

---

## 2. Under-the-hood mechanics

The Tuner's existing text-style edits already apply inline styles to elements in the iframe via `applyTextStyle` in `app/_components/tuner/TunerEditor.tsx:121`. A nudge is the same pattern with different CSS properties.

**Horizontal options and tradeoffs:**
- `text-align` — already exposed as chips (Left/Center/Right/Justify) in `TunerTextPanel.tsx`. Coarse. Works for three states, not for "47px right of center."
- `margin-left` (or `margin-inline-start`) — shifts the element within its flex/block parent, siblings below reflow naturally. Standard. Mobile-hostile in pixels.
- `padding-left` — only works if the element has enough interior to absorb the shift; on an h1 this paints the background (if any) extra wide without moving the glyphs visibly.
- `transform: translateX` — cheap, compositor-only, siblings DON'T reflow. Good for "floating" an element off the grid. Bad for flow-respecting layout — the headline looks moved but its original box still occupies space.
- `align-self` on a flex child — discrete (`flex-start`/`center`/`flex-end`), not continuous.

**Recommendation: `margin-inline-start` / `margin-inline-end` (logical props so RTL works someday) for X, `margin-block-start` / `margin-block-end` for Y.** Flow-respecting, predictable, survives regen, composes cleanly with the Art Director's generated margins.

**Vertical options:** same analysis. `margin-block-start` is the clean answer. `transform: translateY` doesn't reflow siblings and would leave a visual gap where the element "was." Padding on the element itself rarely shifts its visual position.

**Unit.** This is the load-bearing decision. Four options:

| Unit | Desktop nudge of "80px right" becomes on 375px mobile | Recommendation |
|------|---|---|
| `px` | 80px (doesn't scale) → often breaks mobile | ✗ |
| `rem` | scales with root font size, but root is usually fixed → same as px for most users | ✗ |
| `em` | scales with the element's own font size, which already uses `clamp()` → nudge shrinks proportionally on mobile because the h1's computed em does | ✓ |
| `%` (of section width) | scales with viewport directly | ✓ on horizontal, weird on vertical |

**Recommendation: `em` units.** An 80px-on-desktop nudge at a `clamp(3rem, 5vw, 7rem)` headline becomes ~1em. Same 1em at 375px where the headline is `3rem` computed ≈ 48px is a 48px nudge — proportional, never escapes the viewport. This is the only unit that doesn't require the user to know or care that mobile exists.

**Sibling shift.** `margin` flows — siblings below/right move with the nudge. The user dragging the headline down 1em pushes the subhead and CTA down 1em too. This is what Corey described as "rest of the page reflows naturally." Matches intent. If the user wants _only_ the headline to move without disturbing siblings, they'd need `transform` — and that's a different feature (floating, not nudging).

**Override vs compose.** Inline styles via `element.style.marginInlineStart = '1.5em'` cleanly override the Art Director's generated stylesheet rules (inline wins on specificity). On revert, clear the inline property and the generated value re-asserts. No CSS-variable juggling needed for v1.

---

## 3. Mobile + responsive

This is the question that decides whether drag-to-nudge is a product-compatible feature or a silent brand violation. `DESIGN.md` Section 10 declares:

> **Design viewport starts at 375px.** Every component must look correct and be usable at 375px wide before any larger breakpoint is considered.
> **No horizontal scroll, ever.**
> **Content never touches screen edges.** Minimum 16px (1rem) horizontal padding on every scrollable section.

A `px`-based or free-range drag breaks every one of these rules. An 80px rightward drag of the hero headline on a 1440px viewport, naïvely applied to a 375px viewport, blows past the right edge and creates horizontal scroll or clipping. The Art Director agent emits `clamp()`-based typography and `clamp(1rem, 5vw, 3rem)` section padding precisely to avoid this failure mode. A nudge feature that undoes that work is a regression.

**Four candidate policies:**

a) **Apply the same absolute offset at every breakpoint.** Simplest code, catastrophic UX. Rejected.

b) **Scale the offset proportionally.** Choose a unit (`em`, `%` of viewport width, `vw`) that scales with the environment. Near-zero extra code, handles 90% of the use cases. Fails only when a user nudges a large headline so far at 1440px that even the scaled-down 375px version is visually wrong — but this is also mitigable via _clamping_ the nudge (see below).

c) **Desktop-only nudge, mobile ignores it.** Clean but dishonest: the /edit preview shows the headline nudged at 1440px, so users will assume their exported page looks that way everywhere. When they view the downloaded HTML on a phone and see the original Art Director layout reasserting, they'll file a bug.

d) **Store separate nudge values per breakpoint.** The honest answer but the most code. Adds a breakpoint switcher to the Object Mode Text panel, doubles the storage shape, and forces users to tune twice. Overkill for "move the headline down 20 pixels."

**Recommendation: (b) with guardrails.** Use `em` units (see section 2). Clamp the maximum nudge to a value small enough that the mobile-scaled version still respects section padding — e.g., `max(−2em, min(2em, nudge))`. The section's own padding is around `clamp(1rem, 5vw, 3rem)` so a `±2em` nudge at the deepest zoom won't escape the content rectangle. No breakpoint switching, no per-device complexity, no DESIGN.md violation.

**User warning.** With the clamped-em policy, no warning is needed — the nudge provably stays inside the safe zone. If the slider is drag-able from −4em to +4em we'd want a warning; at ±2em we don't.

---

## 4. Persistence

`lib/persistence/edit-log.ts` already has the kinds `text`, `text-style`, `image`, `style`, `accent`, `tuner`, `tuner-preset`, `marquee`. The `builder_edits.edit_json` column is freeform JSON — adding a new kind costs nothing.

**Recommendation: reuse `style` kind,** not a new `nudge` kind. A nudge is just a `style` edit where the changed properties are `marginInlineStart`, `marginBlockStart`, etc. The existing `handleTextStyleCommit` path in `TunerEditor.tsx:1227` already logs text-style patches via `kind: 'style'` with `{element_id, before, after}` shaped as `Record<string, string>`. Adding `marginInlineStart` to the `TextStyle` interface in `TunerImagePanel.tsx`-equivalent for text + wiring it through this existing pipeline costs about 20 lines. The edit row shape stays uniform. Undo/redo works for free because it's the same stack.

If Corey wants nudge to show up as its own icon/category in a future Edit History panel, we can filter `kind:'style'` edits by which CSS properties they touched. That's a lightweight UI-only concern — doesn't justify a new DB shape.

**Regen persistence.** Nudges should survive regeneration when the element they reference still exists in the new DOM. See section 5.

---

## 5. Undo + regen

**Undo/redo.** Unified-history (`lib/tuner/unified-history.ts`) already handles `kind:'style'` entries. Nudge piggybacks on that. Each commit pushes one entry with `apply(doc)` → set the margin properties, `revert(doc)` → clear them. This is exactly what `handleTextStyleCommit` already does. Zero new scaffolding.

**Regen.** Three options as the prompt framed them. My take:

a) Nudges carry forward blindly — correct when the regenerated HTML has the same element ids, incorrect when the Art Director reshaped the hero so the h1 moved. Blind replay risks applying a 1em downward nudge to an element that's now at a different position in the flow.

b) Clear all nudges with a warning — safest, but wipes the user's work on every regen. Fine for v1 but annoying if users regen often.

c) Re-apply nudges against `sectionId` + element-role (e.g. "the h1 in hero-1"). If the regenerated hero still has an h1, the nudge binds to it. This is what `applyTextStyle` already does via `findTextElement(doc, id)` — the `data-irie-edit-id` attributes survive regen if the Assembler preserves them.

**Recommendation: (c), with (b) as the fallback.** Keep nudges in `textStyles[id]`, the same store text-style edits use. On iframe load the replay loop at `TunerEditor.tsx:450` already iterates `textStylesRef.current` and applies. If the id doesn't resolve to an element in the new DOM, the replay is a no-op — no crash, no misapplication. User's nudge is lost only if the target element is lost, which matches intuition.

---

## 6. Conflicts with existing dials

Three existing controls touch spacing:

- **Section TUNE → Padding dial** — multiplies section padding via `--irie-pad-scale` (`lib/tuner/dial-architect.ts:18-29`). Section-level scale factor.
- **Section STYLE → Padding Top / Padding Bottom sliders** — absolute px on the section element itself.
- **Object Mode Text → H Padding / V Padding sliders (CTAs only)** — absolute px on the button/link.

A nudge on a text element is a fourth lever: _element-level_ margin. These compose naturally because they target different layers:

- Section Padding dial scales the section's outer padding (envelope around everything inside).
- Section Style Padding sets the section's top/bottom space absolutely (inside the envelope).
- Element nudge adds margin on the individual text element (inside that padded space).

CSS-wise, a section with `padding-top: 4rem * var(--irie-pad-scale, 1)` plus a headline with `margin-block-start: 1em` composes to: content starts 4rem×scale into the section, then the headline begins 1em below that. Both operations remain independent and predictable.

**Rule to name and stick to: nudge adds to generated margins. It does not multiply and does not override section-level padding. If the user wants the hero content to sit lower in the section, they use Section STYLE → Padding Top. If they want just the headline to sit lower than the subhead, they use the nudge.** The Tuner panel copy should make this distinction visible with labels like "Move this element" (nudge) vs "Section padding" (section). Right now the existing labels already distinguish between section and object modes — continuing that language keeps the mental model clean.

Conflict edge case: a user drags a headline down 1em, then cranks Section TUNE Padding from 1× to 2×. The section's outer padding doubles (more space above and below the content), AND the headline is still 1em below wherever the subhead wants it to sit. Both reads as intended.

---

## 7. Generator round-trip

The Art Director agent (`lib/agents/art-director.ts`) emits a `layoutRhythm` directive the Assembler turns into generated CSS. Today, the agents don't see user edits at all — regen starts from the brief, not from the edited DOM.

**Short answer: v1 does not feed nudges back to the agents.** The Tuner's whole architecture is "user edits apply over generated output; regen blows over user edits unless we carry them forward (section 5)." Adding a learning loop where Art Director considers prior nudges is a separate, larger product decision — it means agents get edit history as input and the prompt contract changes. That's not a v1 drag concern.

**Worth flagging for a future build, not v1:** if we log nudges with enough fidelity, Art Director could someday see "user consistently moves hero headlines 0.5em right" as a signal that its default alignment is off. But that's months out and requires its own RFC.

---

## 8. Accessibility

**Keyboard.** The text element is already focusable (we set `tabindex` in Object Mode Text for contenteditable). Arrow keys on a focused element should nudge — `←` / `→` for horizontal (0.1em steps), `↑` / `↓` for vertical (0.1em steps), `⇧+arrow` for 0.5em. Escape commits + exits drag mode. This gives keyboard users parity with pointer drag for free and means the Object Mode panel's slider and the keyboard gesture both manipulate the same stored value.

**Screen readers.** Drag is visual. The SR equivalent is: when the user focuses a text element in Object Mode, announce its current nudge state ("Hero headline, moved 0.5em right, 0.2em down") via `aria-describedby` pointing at a live region the panel updates. On arrow-key nudge, announce the new offset. On revert, announce "position reset."

**prefers-reduced-motion.** Drag preview uses no animation other than the gold ring thickening and cursor change — both instantaneous transitions, no transform smoothing. The only motion is the cursor itself which the OS handles. Nothing to disable.

---

## 9. Build complexity estimate

Two honest brackets for two honest scopes:

**Full drag-to-nudge as spec'd** — ~3-5 days:
1. Drag-handle chip component, painted inside the selection ring on desktop only (~0.5 day)
2. Mousedown/mousemove/mouseup dispatcher in `TunerEditor` that routes to `handleTextNudge` (~1 day including touch-vs-drag disambiguation on desktop trackpads)
3. Live-apply during drag + HUD readout (~0.5 day)
4. Snap-to-padding-edge boundary logic with em unit conversion (~0.5 day)
5. Object Mode Text slider pair + arrow-key handler mirroring the drag (~0.5 day)
6. Persistence through existing `handleTextStyleCommit` path — trivial because we're reusing `kind:'style'` (~0.25 day)
7. Test the composition with Padding dial + Section Style padding + CTA padding (~0.5 day)
8. Mobile decision — ship as slider-only on `<768px` (~0.25 day)

**Sliders-only v0 (no pointer drag)** — ~1 day:
1. Add `marginInlineStart` + `marginBlockStart` to `TextStyle` in `TunerEditor.tsx` (~0.1 day)
2. Two new `SliderField` rows in `TunerTextPanel` labelled "Nudge X" and "Nudge Y", −2em to +2em, step 0.05em (~0.25 day)
3. Wire through existing `handleTextStyleChange` / `handleTextStyleCommit` (~0.1 day)
4. Arrow-key keyboard shortcut for nudge on focused text (~0.25 day)
5. Test + prod deploy (~0.25 day)

**V0 gets 80% of the value for 20% of the work.** Horizontal align chips already exist. V0 adds fine-grain offset that feels the same to the user whether they drag a slider or drag the element itself.

---

## 10. Alternative that isn't drag

Full drag is expensive to build right and cheap to build wrong (gesture ambiguity on touch, scroll conflicts, pointer-handle painting, drop-zone visualization, breakpoint scaling). Before committing to it, ask whether Corey's literal need — "move the headline down/left/right a bit" — can be served by controls that already live in the Object Mode Text panel.

Current state:
- **Text-align chips** (Left/Center/Right/Justify) solve the coarse horizontal case
- **Size slider** already adjusts typography, which indirectly changes positioning
- No control exists for: vertical position, fine horizontal offset within an alignment

**Proposed v0 additions to Object Mode Text (same panel, two new sliders):**

- **Nudge X** — slider −2em to +2em, step 0.05em, maps to `margin-inline-start`. Negative values pull left, positive push right, relative to whatever alignment chip is selected.
- **Nudge Y** — slider −2em to +2em, step 0.05em, maps to `margin-block-start`. Negative values pull up (overlap-to-previous-sibling-avoided by a min-clamp), positive push down.
- **Arrow-key shortcut** when an Object Mode Text element is focused: `←→↑↓` in 0.1em steps, `⇧+arrow` in 0.5em steps. This is the keyboard equivalent of drag.
- Per-axis revert icon, same pattern as existing dial reset.

What this does _not_ solve:
- Users who explicitly want the pointer-drag gesture on the canvas. For them, v0 is "wrong workflow" even if it produces identical results.
- Absolute positioning — user wants the headline 300px from top-left of hero regardless of subhead. V0 stays flow-respecting; absolute positioning is a different feature.

What this _does_ solve:
- The described need ("nudge the hero headline down / left / right")
- At every breakpoint, without DESIGN.md violation
- With the existing persistence, undo, regen, and command-palette infrastructure
- Without introducing the gesture-disambiguation problem that has eaten entire sprints at other design tools

---

## Recommendation

**Ship v0 — sliders + arrow keys — first. Two Object Mode Text sliders ("Nudge X", "Nudge Y"), em units, ±2em range, step 0.05em, with arrow-key keyboard parity. One day of work. Reuses existing text-style persistence, undo, and panel scaffolding.**

Watch usage for two weeks. If Corey or other users genuinely want to drag the element on the canvas instead of moving a slider, build the full pointer-drag on top of the same underlying store in a follow-up — the v0 sliders become the headless controls the drag gesture writes to. Nothing is wasted; drag becomes a thin gesture layer over a stable data model.

If we build drag first, we introduce gesture ambiguity on both desktop and mobile, commit to breakpoint-handling edge cases, and carry a bigger maintenance surface — all to add an affordance that produces identical stored state to what two sliders produce. It's the right feature shape if we're sure users want _the gesture itself_. We're not sure yet.

The slider path is honest: it gives the user the outcome they described (nudge within section) now, preserves mobile-first integrity, and leaves the door open to the drag gesture if usage proves it's worth the complexity.

## Questions for Corey

None blocking. Two worth answering before v0 lands, neither of which affects this scoping:
1. Is `marginInlineStart` acceptable even though it's a logical property (pointing to a future RTL audience), or do you want plain `marginLeft` for v0 simplicity? Affects one line.
2. If a future pointer-drag _is_ built, is it acceptable that the drag only fires on desktop (no touch-drag)? Assumes yes based on your existing Tuner mobile pattern (precision lives in the right panel on mobile), but flagging.
