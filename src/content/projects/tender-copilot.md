---
title: "tender-copilot"
summary: "Reads an Indian government RFP and returns bid or skip: the score against the qualification gate, and the exact clauses that get bids rejected."
outcome: "Validated on a live ₹3 Cr municipal bid — caught four real defects before the deadline."
stack: ["Python", "zero dependencies"]
repo: "https://github.com/ajal2/tender-copilot"
date: "2026-06-08"
status: "active"
featured: true
draftedBy: "human"
---
Indian government RFPs are 100-page documents where a single buried clause
disqualifies you — and a bad eligibility call forfeits the earnest-money
deposit. tender-copilot reads one and returns a decision: bid, conditional
bid, or no-bid, with the qualification score and the specific clauses most
likely to get the bid rejected.

## How it works

The engine is five boxes and two human gates. A tender schema ranks every
requirement by where it appears — checklist versus buried prose — because that
changes the real risk. An evaluator scores the bidder profile against the
qualification rubric. The star is the auditor: it checks what the bid *claims*
against what was actually assembled, because the most catchable defect isn't a
missing file — it's a compliance letter pointing at a document that isn't
there. Extraction carries per-field confidence and fails loud: anything
uncertain goes to a human queue, never a silent guess.

## Validated on a real bid

Run end-to-end on the Sangareddy 50 TPD C&D tender, a live ₹3 Cr municipal
contract bid as a JBSS LLP joint venture: the engine reproduced the 80/100
qualification score and caught four real defects on the submitted bid before
the deadline. Bid submitted, award pending — this claims a validated process,
not a win.

## Honest limits

PDF-to-schema extraction is deliberately a human-reviewed research stage, not
faked automation. The public repo carries a synthetic company profile — no
financial documents live there.
