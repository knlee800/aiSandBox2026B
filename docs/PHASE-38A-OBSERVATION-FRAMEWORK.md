# PHASE-38A — External User Pilot Observation Framework

---

## Document Purpose

This framework defines the structure, metrics, and protocol for conducting real-user validation of the AI Sandbox Platform's unified product surface at `/[locale]/app`.

**Nature:** Observation only — no implementation, no fixes, no redesign.

**Goal:** Validate whether real developers can successfully use the platform without guidance.

---

## Test Protocol

### Pre-Test Setup

**System Requirements:**
- Platform must be running and accessible
- `/[locale]/app` endpoint must be live
- All core services operational (API Gateway, AI Service, Container Manager)
- Monitoring/logging enabled for session tracking

**Observer Requirements:**
- Quiet observation mode (no hints, no guidance)
- Screen recording or detailed note-taking
- Timer for measuring task duration
- Emotional tone tracking (confidence vs hesitation)

**User Requirements:**
- 2–5 real developers (external to project team)
- No prior exposure to the platform
- Basic familiarity with API keys and web development
- No pre-briefing or documentation provided

---

## Test Scenario

### User Journey (Unassisted)

Each user should attempt the following tasks **without assistance**:

#### Task 1: Access Platform
- Navigate to `/[locale]/app`
- Understand what the platform does
- Identify next action

**Success Criteria:** User understands purpose within 30 seconds

---

#### Task 2: Create API Key
- Locate API key creation interface
- Generate a new API key
- Understand what the key is for

**Success Criteria:** User successfully creates key and knows its purpose

---

#### Task 3: Execute First Prompt
- Use their API key to execute a prompt
- Understand how to input the prompt
- Understand how to submit the request

**Success Criteria:** User successfully executes a prompt and receives response

---

#### Task 4: Interpret System Status
- Understand execution status
- Identify when execution completes
- Locate execution results

**Success Criteria:** User correctly interprets system feedback

---

#### Task 5: Recover from Failure
- Intentionally trigger one failure scenario:
  - Wrong API key format
  - Invalid prompt
  - Network timeout (simulated)
- Observe recovery behavior

**Success Criteria:** User identifies error and attempts correction

---

## Observation Categories

### 1. First-Time Comprehension

**What to Observe:**
- Time to understand platform purpose
- Time to identify first action
- Confusion points in UI/UX
- Misinterpretation of labels or instructions

**Recording Format:**
```
User [ID] | Timestamp | Observation | Severity (P0/P1/P2)
```

---

### 2. Task Completion Without Assistance

**What to Observe:**
- Number of tasks completed unassisted
- Tasks requiring hints or guidance
- Tasks abandoned due to confusion
- Workarounds or unexpected paths taken

**Recording Format:**
```
Task [Name] | User [ID] | Status (Complete/Partial/Failed) | Notes
```

---

### 3. Error Recovery Ability

**What to Observe:**
- Error message comprehension
- Correction attempts (correct vs incorrect)
- Time to recover from error
- Emotional response to failure

**Recording Format:**
```
Error Type | User [ID] | Recovery Success | Time to Recover | Notes
```

---

### 4. Cognitive Load

**What to Observe:**
- Visible hesitation or pauses
- Re-reading of instructions
- Switching between tabs/windows
- Verbal expressions of confusion

**Recording Format:**
```
User [ID] | Timestamp | Behavior | Cognitive Load (Low/Medium/High)
```

---

### 5. Trust in the System

**What to Observe:**
- Confidence in clicking buttons
- Willingness to retry after failure
- Skepticism about system responses
- Verification behaviors (checking multiple times)

**Recording Format:**
```
User [ID] | Behavior | Trust Level (High/Medium/Low) | Notes
```

---

### 6. Perceived Product Readiness

**What to Observe:**
- Verbal feedback on polish/completeness
- Comparison to other tools
- Willingness to use in production
- Suggestions for improvement

**Recording Format:**
```
User [ID] | Feedback | Readiness Perception | Notes
```

---

## Metrics Collection

### Quantitative Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Completion Rate** | % of users who complete all 5 tasks unassisted | ≥ 80% |
| **Time to First Success** | Time from landing to first successful prompt execution | ≤ 3 minutes |
| **Confusion Pauses** | Number of 5+ second pauses per user | ≤ 3 |
| **Misinterpretation Count** | Number of incorrect assumptions per user | ≤ 2 |
| **Error Recovery Rate** | % of users who successfully recover from induced error | ≥ 70% |
| **Assistance Required** | Number of hints/guidance interventions per user | 0 (ideal) |

---

### Qualitative Metrics

| Metric | Scale | Recording Method |
|--------|-------|------------------|
| **Emotional Tone** | Confident / Neutral / Hesitant / Frustrated | Observer notes |
| **UI Clarity** | Clear / Acceptable / Confusing | User feedback |
| **Error Message Quality** | Helpful / Neutral / Unhelpful | User feedback |
| **Overall Experience** | Smooth / Acceptable / Rough | User feedback |

---

## Issue Classification

### Priority Levels

**P0 — Blocker**
- User cannot complete core task
- System is broken or inaccessible
- Data loss or security issue
- Requires immediate fix before ship

**P1 — Critical**
- User completes task but with significant friction
- Misinterpretation leads to incorrect action
- Error recovery is unclear
- Should fix before ship

**P2 — Important**
- User completes task but with minor friction
- UI polish or microcopy improvement
- Nice-to-have enhancement
- Can ship and iterate

---

### Issue Recording Template

```markdown
## Issue [ID]

**Priority:** P0 / P1 / P2
**Category:** Comprehension / Navigation / Error Handling / Trust / Other
**Observed By:** [Observer Name]
**User(s) Affected:** [User IDs]
**Timestamp:** [Time]

**Description:**
[What happened]

**User Behavior:**
[What the user did or said]

**Expected Behavior:**
[What should have happened]

**Impact:**
[Effect on task completion]

**Frequency:**
[How many users experienced this]

**Recommendation:**
[Suggested fix — DO NOT IMPLEMENT]
```

---

## Post-Test Analysis

### Readiness Assessment

After all users complete testing, classify readiness:

**SHIP** — System is ready for production
- Completion rate ≥ 80%
- No P0 issues
- ≤ 2 P1 issues
- Positive emotional tone
- Users express confidence

**ITERATE** — System needs refinement
- Completion rate 50–79%
- No P0 issues
- 3–5 P1 issues
- Mixed emotional tone
- Users express hesitation

**BLOCKED** — System not ready
- Completion rate < 50%
- Any P0 issues
- > 5 P1 issues
- Negative emotional tone
- Users express frustration

---

## Checkpoint Requirements

After testing completes, produce:

**`docs/PHASE-38A-CHECKPOINT.md`**

Must include:

1. **Test Setup**
   - Number of users
   - Date/time of testing
   - System version/state
   - Observer(s)

2. **Completion Summary**
   - Completion rate per task
   - Time to first success (per user)
   - Assistance interventions (per user)

3. **Observed Friction Points**
   - List all recorded issues
   - Classify by priority (P0/P1/P2)
   - Include frequency data

4. **Metrics Summary**
   - Quantitative metrics table
   - Qualitative metrics summary

5. **User Feedback**
   - Direct quotes (anonymized)
   - Emotional tone summary
   - Readiness perception

6. **Readiness Assessment**
   - Clear statement: **SHIP / ITERATE / BLOCKED**
   - Justification based on metrics
   - Recommended next phase

7. **Issue Registry**
   - All issues in standardized format
   - Prioritized list
   - No implementation details

---

## Constraints Reminder

**During Observation:**
- ❌ NO hints or guidance (unless completely blocked)
- ❌ NO leading questions
- ❌ NO explaining system behavior
- ❌ NO fixing issues mid-test

**After Observation:**
- ❌ NO implementation
- ❌ NO code changes
- ❌ NO endpoint additions
- ❌ NO UX redesign
- ✅ ONLY documentation and classification

---

## Stop Condition

Stop immediately after checkpoint creation.

Do NOT:
- Suggest fixes
- Implement changes
- Proceed to Phase 38B
- Refactor anything

Wait for explicit authorization to proceed.

---

## Authority

This framework is governed by:
- `CLAUDE.md` — Working contract
- `PRD.md` — Product intent
- `TASKS.md` — Scope authorization

If conflicts exist, governance rules take precedence.

---

**Status:** READY FOR EXECUTION
**Next Step:** Conduct pilot with 2–5 real users
**Deliverable:** `docs/PHASE-38A-CHECKPOINT.md`
