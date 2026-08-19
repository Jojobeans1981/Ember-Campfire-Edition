# Ember — Campfire Edition

**A reading tutor for dyslexic learners, built on the Orton-Gillingham approach —
visual, auditory, and tactile instruction delivered together rather than in sequence.**

Most reading apps teach words. Ember teaches the structure underneath them: sounds,
letter patterns, and the rules that connect them — explicitly, in order, and through
more than one sense at a time.

<!-- TODO: add a screenshot or short GIF of a learner working through an exercise.
     For an app whose whole premise is multisensory interaction, showing it matters
     more than describing it. -->

---

## Why this exists

Dyslexia isn't a vision problem or a motivation problem. It's a difficulty mapping
sounds to symbols — phonological processing — and it doesn't resolve through more
reading practice. A learner who can't reliably decode `b` from `d`, or hear that
*strap* has five distinct sounds, doesn't get better by being handed more books.

The Orton-Gillingham approach has been the evidence-based answer to this for decades.
Its core principles:

- **Multisensory** — every concept is seen, heard, and physically traced in the same
  moment, so three pathways encode it instead of one
- **Structured and sequential** — skills build in a fixed order, and nothing is
  introduced until its prerequisites are solid
- **Explicit** — rules are taught directly, never inferred from exposure
- **Diagnostic and prescriptive** — instruction responds to the individual learner's
  specific errors, not to a fixed curriculum pace

The problem is access. Orton-Gillingham is traditionally delivered one-on-one by a
trained specialist, which is expensive and scarce. Most kids who need it don't get it.

**Ember is an attempt to deliver the method's structure without requiring the
specialist in the room.**

---

## The hard part: tactile in a browser

Visual and auditory are straightforward on the web. You render a letter, you play a
phoneme. Done.

**Tactile is the one that doesn't translate**, and it's not optional — in
Orton-Gillingham, the physical tracing of a letter *while* saying its sound and seeing
its shape is the mechanism, not decoration. Remove it and you have a phonics app, not
a multisensory one.

**Ember's answer is letter tracing with haptic feedback.** The learner traces the
letterform directly on screen while its sound plays. The device vibrates against the
stroke — so the hand receives a signal the eyes don't have to interpret, and the
physical shape of the letter is encoded through movement rather than observation.

This is the closest browser-native analog to sand-tray and textured-card work, and it
preserves the property that matters most: **simultaneity.** Sound, shape, and movement
co-occur. An app that plays the sound, *then* shows the letter, *then* asks for a trace
has three sequential exercises, not one multisensory one.

<!-- TODO: worth adding if true — is stroke order/direction enforced, or only the
     final shape? Direction is what encodes the motor distinction between b and d,
     so if you enforce it, say so. -->

---

## The celebration is instruction, not reward

When a learner gets it right, Ember doesn't hand out a badge or a point total. It
replays what they just learned — the letter, the sound, the shape — as the celebration
itself, amplified visually and audibly.

This is deliberate. The moment immediately after success is when a learner is most
receptive and least defended, and spending it on a generic reward wastes it. By making
the reinforcement *carry the content*, every correct answer becomes one more exposure
through the same channels that taught it.

It also avoids a specific failure mode in educational software: when the reward is
more engaging than the lesson, the child optimizes for the reward. Here there's nothing
to optimize toward except the material.

For dyslexic learners in particular — who often arrive with years of accumulated
failure around reading — a success moment that restates *what they can now do*, rather
than just signaling "correct," does something a score counter can't.

---

## The exercise loop

1. The letter is presented and its sound plays
2. The learner traces the letterform, with haptic feedback marking the stroke
3. On success, the celebration replays the letter and its sound — reinforcement that
   carries the content rather than replacing it

Concepts are introduced in Orton-Gillingham order, each building on the ones before it.

<!-- TODO: add if implemented — does Ember track which phonemes or letterforms a
     given learner keeps missing and adjust what comes next? That's the
     "diagnostic and prescriptive" pillar and it deserves its own section near
     the top if it exists. Also: what does a parent or teacher see for progress? -->

---

## Stack

JavaScript.

<!-- TODO: expand — framework, how audio is handled, how tracing input is captured
     and scored, and any AI components and what they actually do. -->

---

## Running locally

```bash
git clone https://github.com/Jojobeans1981/Ember-Campfire-Edition.git
cd Ember-Campfire-Edition
npm install
npm run dev
```

<!-- TODO: verify these match your setup. Note any required API keys or assets. -->

---

## Status and direction

This is an early edition — the goal was to prove the multisensory loop works in a
browser before building out the full Orton-Gillingham scope and sequence.

<!-- TODO: what's next? Full sequence coverage, speech recognition for reading aloud,
     educator dashboards, offline support? Naming the roadmap tells visitors whether
     this is alive. -->

---

## A note on evidence

Orton-Gillingham's multisensory principles are well established in reading research,
but **Ember has not been studied for efficacy.** It is a tool built on a recognized
method, not a validated intervention, and it is not a substitute for assessment or
instruction by a qualified specialist.

If you're an educator or researcher and want to talk about that gap, open an issue —
I'd like to close it.

---

## Contributing

Issues and PRs welcome, particularly from people who teach reading. If you're an
Orton-Gillingham practitioner and something here misrepresents the method, please say
so — that feedback is more valuable than code.

---

Built by [Giuseppe Panetta](https://linkedin.com/in/jlpanetta1681).
