#!/usr/bin/env bash
# Launcher for the lecture-notes port. Picks the model for the current phase,
# sets up the helper agents, and starts Claude Code with the right prompt.
#
#   ./_port/go.sh           choose automatically (recommended)
#   ./_port/go.sh opus      force Opus as the main model, no Fable anywhere
#   ./_port/go.sh sonnet    force Sonnet everywhere (use when Opus is rate-limited)
#   DRY_RUN=1 ./_port/go.sh show what would run, without starting Claude
set -euo pipefail

NOTES="${NOTES:-/home/dlopez/Documentos/0.profesional/Academic/4.Postdoc1/USP/Projects/learning_cosmology/lecture_notes_differential_geometry_GR/from_diff_geom_to_GR}"
BRANCH="course-diffgeo-gr"
# Fable is included in Pro / Team-standard limits until 2026-11-16 23:59 PT
# (= 2026-11-17 07:59 UTC). Stop choosing it two hours earlier, to be safe.
FABLE_FREE_UNTIL_UTC="2026-11-17 05:59"
FABLE_MODEL="claude-fable-5-2"
MIN_VERSION_FOR_FABLE="2.1.321"

MODE="${1:-auto}"
case "$MODE" in auto|opus|sonnet) ;; *) echo "usage: $0 [auto|opus|sonnet]"; exit 2 ;; esac

say()  { printf '\033[1;36m[go]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[go]\033[0m %s\n' "$*" >&2; exit 1; }

# --- locate the repo and check the basics -----------------------------------
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
[ -f _quarto.yml ]        || fail "This does not look like the website repo: $REPO"
[ -f _port/KICKOFF.md ]   || fail "Missing _port/KICKOFF.md"
[ -f _port/RESUME.md ]    || fail "Missing _port/RESUME.md"
[ -d "$NOTES" ]           || fail "Lecture notes directory not found: $NOTES"
command -v claude >/dev/null || fail "claude is not on PATH"

# A stray API key would bill per token instead of using the subscription.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN

# --- branch ------------------------------------------------------------------
current="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current" != "$BRANCH" ]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    say "Switching to branch $BRANCH"; [ -n "${DRY_RUN:-}" ] || git switch "$BRANCH"
  else
    say "Creating branch $BRANCH"; [ -n "${DRY_RUN:-}" ] || git switch -c "$BRANCH"
  fi
fi

# --- helper agents and routing rules (written once, never overwritten) -------
mkdir -p .claude/agents

[ -f .claude/agents/port-worker.md ] || cat > .claude/agents/port-worker.md <<'EOF'
---
name: port-worker
description: Implements one well-specified unit of the lecture-notes port whose design is already decided, such as a converter handler for one LaTeX construct, the conversion fixes for one chapter, or an interactive figure that follows an established pattern.
model: opus
effort: high
---

You implement one unit of the port of the lecture notes "From Differential Geometry to General Relativity" to a Quarto website. The main agent gives you a brief for the unit.

Before starting, read `CLAUDE.md`, the section "Rules that are not negotiable" in `_port/KICKOFF.md`, and `_port/DECISIONS.md`. Those rules bind you: the notes' content is never reworded, pages are produced by the converter and never edited by hand, the notes directory is read-only, and nothing is pushed.

Follow the patterns already established in the repo. You do not make design decisions. If the brief does not cover something and the existing patterns do not settle it, stop and report the question instead of inventing an answer.

Do not commit and do not edit `_port/PROGRESS.md`; the main agent does both after reviewing your work.

End with a short report: what you changed (files), which checks you ran and their results, and anything you are unsure about. No long logs.
EOF

[ -f .claude/agents/port-checker.md ] || cat > .claude/agents/port-checker.md <<'EOF'
---
name: port-checker
description: Runs the build and the checks for the course pages (render, fidelity diff, headless-browser checks, screenshot comparison against the PDF) and reports the failures concisely. Use after every unit and before every commit.
model: sonnet
effort: medium
---

You verify the course pages of a Quarto website generated from LaTeX lecture notes. The main agent tells you what to check; the commands are in `CLAUDE.md`.

Run the checks you are asked for. When asked to review screenshots, compare each page with the corresponding PDF page and look for what a careful reader would notice: broken or missing math, wrong symbols or fonts, lost colour coding, overflowing equations, unreadable figures, wrong numbering, broken layout.

You do not fix anything and you do not edit source files. The notes directory is read-only.

Report one line per check: passed or failed. For each failure give the minimal evidence needed to act on it (page or file, line or selector, the message, one sentence on what is wrong). Do not paste full logs.
EOF

[ -f _port/MODELS.md ] || cat > _port/MODELS.md <<'EOF'
# Models and delegation

My plan has small usage limits and the strongest model is the scarcest. A launcher (`_port/go.sh`) picks the main model for each session; your part is to spend it well.

## Phase marker

Keep the first line of `_port/PROGRESS.md` as `PHASE: design` until I approve the pilot, then change it to `PHASE: bulk`. The launcher reads this line to choose the model, so it must always be the first line and always be current.

## Who does what

- **You, the main agent**, do what sets direction: reading the source, architecture, every decision, the first instance of each kind of thing (the first converter handler for a kind of construct, the first interactive figure of each type), reviewing delegated work, the ledger, and commits.
- **`port-worker` (Opus)** does units that repeat an established pattern. Give it a self-contained brief: the goal, the files involved, the existing example to follow, and the checks that must pass. Review its report and its diff before committing.
- **`port-checker` (Sonnet)** runs every render, check and screenshot review, so that logs and images stay out of your context. Act on its report.
- **Explore** for searching the repos.

Never start a subagent on a Fable model.

## If you are running on Fable

You have a limited Fable allowance and it will not last the whole job. Use it for the design phase: understanding the source, the plan, the converter architecture, the hard points (runic symbols in math, numbering, TikZ to SVG, cross-references), and the pilot. Be the architect and delegate the typing. Write decisions down in `_port/DECISIONS.md` with enough reasoning that a different model can follow them later without asking you.

## If you are running on Opus or Sonnet

Follow `_port/DECISIONS.md` and the patterns already in the repo. When a design question comes up that they do not cover: if an advisor is available, consult it for that question only (each consultation rereads the whole conversation, so keep them rare); otherwise record the question under "Needs a design decision" in `_port/PROGRESS.md`, carry on with units that do not depend on it, and tell me.

## Keep sessions short

A long conversation is reread on every turn and eats the allowance. Work one unit at a time. After a few units, or once the conversation has grown large, finish the current unit, update the ledger, commit, and tell me to restart with `./_port/go.sh`. A fresh session that reads the ledger is cheaper than a long one.
EOF

# --- choose the model --------------------------------------------------------
now=$(date -u +%s)
cutoff=$(date -u -d "$FABLE_FREE_UNTIL_UTC" +%s)
fable_free=0; [ "$now" -lt "$cutoff" ] && fable_free=1

phase="design"
if [ -f _port/PROGRESS.md ] && head -n 5 _port/PROGRESS.md | grep -qi '^PHASE:[[:space:]]*bulk'; then
  phase="bulk"
fi

version="$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || true)"
version_ok=1
if [ -n "$version" ]; then
  lowest="$(printf '%s\n%s\n' "$version" "$MIN_VERSION_FOR_FABLE" | sort -V | head -n1)"
  [ "$lowest" = "$MIN_VERSION_FOR_FABLE" ] || version_ok=0
fi

MAIN=""; ADVISOR=""; SUB="opus"; FORCE_SUB=0
case "$MODE" in
  opus)   MAIN="opus" ;;
  sonnet) MAIN="sonnet"; SUB="sonnet"; FORCE_SUB=1 ;;
  auto)
    if [ "$fable_free" = 1 ] && [ "$version_ok" = 0 ]; then
      fail "Claude Code $version is too old for Fable 5.2. Run: claude update   (or: $0 opus)"
    fi
    if   [ "$fable_free" = 1 ] && [ "$phase" = "design" ]; then MAIN="$FABLE_MODEL"
    elif [ "$fable_free" = 1 ];                            then MAIN="opus"; ADVISOR="fable"
    else                                                        MAIN="opus"
    fi ;;
esac

# Subagents without their own model must never inherit Fable.
export CLAUDE_CODE_SUBAGENT_MODEL="$SUB"
if [ "$FORCE_SUB" = 1 ]; then export CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1; fi

if [ -f _port/PROGRESS.md ]; then
  PROMPT="Read _port/RESUME.md and _port/MODELS.md and carry them out."
else
  PROMPT="Read _port/KICKOFF.md and _port/MODELS.md and carry them out."
fi
NAME="course-port-$(date +%m%d-%H%M)"

say "Phase: $phase   Main model: $MAIN${ADVISOR:+   Advisor: $ADVISOR}   Subagents default: $SUB"
if [ "$fable_free" = 1 ]; then
  say "Fable is chosen automatically until $FABLE_FREE_UNTIL_UTC UTC. If its allowance runs out first: /model opus, or restart with: $0 opus"
else
  say "The free Fable window is over; Fable is not used."
fi
say "Before the first prompt, check /status (USP account) and /model (no 'Requires usage credits' on the chosen model)."

run() {  # $1 = advisor or empty
  local args=(--model "$MAIN" --effort high --add-dir "$NOTES" -n "$NAME")
  [ -n "$1" ] && args+=(--advisor "$1")
  if [ -n "${DRY_RUN:-}" ]; then printf '[dry run] claude'; printf ' %q' "${args[@]}" "$PROMPT"; echo; return 0; fi
  claude "${args[@]}" "$PROMPT"
}

start=$(date +%s)
set +e
run "$ADVISOR"; rc=$?
set -e
# If Claude refused to start with the advisor (it exits at once), retry without it.
if [ -n "$ADVISOR" ] && [ "$rc" -ne 0 ] && [ $(( $(date +%s) - start )) -lt 20 ]; then
  say "Could not start with the Fable advisor; starting without it."
  run ""
fi
