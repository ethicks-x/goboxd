---
description: Build a sandbox that runs untrusted code — in Go, on Linux. A three-stage hackathon by SEEK at Paradox, IIT Madras.
title: goboxd · A hackathon at Paradox, IIT Madras
---

A hackathon at Paradox, IIT Madras · 2026

# goboxd

Build a sandbox that runs untrusted code — in Go, on Linux.

Three stages. Ten days online, two days at Paradox. Cash, internships, and the kind of problem you don't get to work on in a classroom.

[Register](https://docs.google.com/forms/d/e/1FAIpQLSeis6PSVKp43kDZYzZf0JDja0u3b3y9wSGXR2Oujw1bW1EEsQ/viewform) [Read the spec](spec.html) 

May 22 → Paradox finale · solo or pairs · open registration

 

Who this is for

## If you like the layer where code meets the operating system, this one is for you.

You'll spend time inside Linux namespaces, cgroups, and process isolation. You'll design an HTTP service in Go that has to stay fast under load and refuse to break when fed adversarial inputs. You'll close real security holes that exist in production sandbox software today — not toy ones.

This is a good fit if you're drawn to **systems programming, Linux internals, Go, concurrency, sandboxing, security, or container-style isolation** — or if you just want to find out whether that kind of work is for you. No prior nsjail experience expected. We give you a working Python reference to read so you start with a behaviour to match, not a blank page.

What you'll build

## goboxd — "Go sandbox daemon."

A small HTTP service that accepts a snippet of code, compiles and runs it inside an nsjail sandbox, and returns per-test results. Other people's code execution platforms do this. Yours will too.

To get you started, we hand you a working reference implementation in Python and Flask. It runs, it has tests, and it has a handful of deliberate security holes that we'll point you at directly. Read it as a behaviour spec. Then design the Go version the way you think it should be designed.

 

The stack you'll be working in — from your Go process down through namespaces, into the kernel.

### The three things we care about most

* **A clean plug-and-play language registry.** On demo day, we'll hand you a language you don't support and ask you to add it in under 30 minutes. No Go code change. One YAML edit and an install script.
* **Concurrency that holds up under sustained load.** Not a micro-benchmark. We'll run real traffic at your service.
* **Security holes closed, on purpose, and documented.** Pick five of the seven we list, fix them, and tell us in your PR exactly where you fixed each.

The three stages

## From May 22 to Paradox.

Stage 01

Online · May 22 – June 1

### Build a prototype

Ten days. A working sandbox that talks the API. Auto-evaluated on technical quality, documentation, and how you handle the basics of an SDLC — branches, tests, commit history.

**10 teams advance.**

Stage 02

Online · June 4 – 5

### Extend to multiple languages

24–36 hours. The 10 teams get an extension brief: your sandbox now needs to handle multiple language toolchains, plug-and-play.

**Same 10 teams continue.**

Stage 03

In person · Paradox · 24 hours

### Harden it under pressure

The final brief drops the morning of: security pressure and concurrent load. You work alongside SEEK engineers and demo what you built. This is when we get to know you.

**Winners announced on site.**

Rewards

## Cash rewards. Internship offers.

### Cash prizes

* 1st place₹50,000
* 2nd place₹25,000
* 3rd place₹10,000

Paid to all three podium teams.

### Internship at SEEK

Two slots · 4 months · ₹18,000 – ₹25,000 per month

Two paid internships at SEEK's tech team — one for each of the top two teams.

Who takes the slot and the exact stipend are decided after a short technical discussion.

Eligibility & logistics

Who can register

All IITM BS Students. Open registration for Stage 1.

Team size

Solo, or pairs of two. No larger teams.

Where

Stages 1 and 2 are online. Stage 3 is in person at Paradox, IIT Madras.

How you register

Hit the Register button at the top of this page. The form opens shortly.

FAQ

## Questions we expect.

Do I need to know nsjail already?

No. The reference repo uses nsjail, and we'll point you at the upstream docs. Curiosity is enough.

Which Go HTTP framework should I use?

Any of them — net/http, chi, echo, gin, whatever. Justify your choice in your README in two sentences.

Can I work solo?

Yes. Team size is 1 or 2.

What if I don't make it past Stage 1?

You walk away with a working Go service you wrote in ten days. Worth keeping on a portfolio.

I'm not from IIT Madras. Can I still join?

You can play, not place. Stages 1 and 2 are online and open to all. If you reach Stage 3, you'll need to be registered for Paradox in person. Non IITM-BS students are not allowed.

What happens at Stage 3 besides building?

You'll work near SEEK engineers, demo what you built, and have informal conversations about how you think and work. The interaction matters.

How do you actually judge?

A weighted rubric across the plug-and-play language model, concurrency, API conformance, security, code quality, extra languages, and health endpoints. Full table on the [spec page](spec.html#judging).

Where do I ask questions?

GitHub Discussions on this repo. [Open a thread.](https://github.com/intern-iitm/goboxd-hackathon/discussions)

## Ready?

Registration is open. The first stage starts May 22.

[Register](https://docs.google.com/forms/d/e/1FAIpQLSeis6PSVKp43kDZYzZf0JDja0u3b3y9wSGXR2Oujw1bW1EEsQ/viewform) [Read the spec](spec.html) 