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
