# Lessons — Planning & Communication

## Communication errors

### 2026-03-02 — User correction: asked if more info is needed before starting split plan
- **Pattern:** when user asks to proceed with planning, respond with a binary readiness answer first (`Yes, I can start now` / `I need X first`) and then list only truly blocking decisions.
- **Prevention rule:** never leave kickoff requirements implicit; always include a short "Required inputs" checklist with defaults.
- **Hard rule:** for architecture splits, always define:
  1. release strategy (new publishers/IDs),
  2. backward-compatibility policy,
  3. migration data strategy,
  4. cross-extension contract policy.


### 2026-03-02 — User decision capture must be persisted immediately
- **Pattern:** when user answers required-input checklist items, persist those answers directly into planning docs/checklists before continuing milestones.
- **Prevention rule:** do not leave checklist items unchecked after explicit user decisions.
- **Hard rule:** for migration requests, explicitly document verification-before-delete behavior for legacy files.


### 2026-03-02 — User feedback: planning-only progress felt stalled
- **Pattern:** after planning milestones, begin at least one concrete code change in the next step unless user explicitly asks for docs-only.
- **Prevention rule:** when user asks "when do we start changes", immediately ship an implementation slice in the next milestone.
- **Hard rule:** for migration work, include tests that prove destructive actions are gated by validation.


### 2026-03-02 — User correction: status should reflect real implementation, not just specs
- **Pattern:** marking milestones complete based on `.md` specs created confusion.
- **Prevention rule:** only mark milestone complete when code changes + verification exist for that milestone.
- **Hard rule:** use explicit labels: `spec ready`, `partial implementation`, `implemented`.


### 2026-03-02 — User requirement: always include next steps + recommended actions
- **Pattern:** after implementation updates, user expects explicit actionable next steps and recommendations.
- **Prevention rule:** every completion message must include a short "Next steps" and "Recommended actions" section.
- **Hard rule:** do not close implementation updates without naming the immediate next milestone and 2-3 concrete actions.


### 2026-03-02 — User directive: keep monolith running until all 4 extracted extensions work
- **Pattern:** extraction must be additive-first, not replace-in-place.
- **Prevention rule:** never remove monolith paths while any extracted extension is incomplete.
- **Hard rule:** deprecation/removal only after all 4 extensions pass functional verification.


### 2026-03-02 — User directive: keep implementing continuously until completion
- **Pattern:** user wants uninterrupted execution of sequential milestones, not one-off increments.
- **Prevention rule:** after each merged increment, immediately continue with the next atomic implementation step unless blocked.
- **Hard rule:** do not switch back to planning-only updates while implementation milestones remain open.


### 2026-03-02 — User directive: execute in large batches without pause
- **Pattern:** user asked to complete remaining implementation in batch mode without intervention.
- **Prevention rule:** bundle multiple dependent milestones per commit batch when safe, rather than single-step cadence.
- **Hard rule:** after each batch, clearly state what is fully done vs partial to avoid false completion claims.

### 2026-03-03 — User correction: execute P15/P16/P17 in one uninterrupted batch
- **Pattern:** user prefers grouped execution of consecutive milestones rather than isolated single-milestone cycles.
- **Prevention rule:** when milestones are tightly coupled (contracts/compat/CI), implement them in one coordinated batch and report complete vs partial clearly.
- **Hard rule:** for extraction work, include both runtime compatibility updates and CI changes in the same implementation cycle when requested together.

### 2026-03-03 — User correction: continue immediately to next milestone step
- **Pattern:** when asked to "continue with the next step", advance the next open milestone directly instead of revisiting already completed scope.
- **Prevention rule:** read `tasks/todo.md` first, pick the first incomplete item in dependency order, and execute it in the same batch.
- **Hard rule:** do not restate prior milestone work as new progress when user asks to continue.

### 2026-03-03 — User correction: prefer suite prefix + functional suffix naming
- **Pattern:** user requested branding in format `Leo's Tools - (Core function)` instead of plain standalone names.
- **Prevention rule:** for marketplace naming requests, apply requested naming template consistently across all extracted extensions in one batch.
- **Hard rule:** if user specifies naming format, do not propose alternatives as default output—implement that format first.
