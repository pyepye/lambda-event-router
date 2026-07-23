---
sidebar: false
aside: false
prev: false
next: false
---

# About

Lambda Event Router is built by [Matt Pye](https://github.com/pyepye).

## Why I built it

I have been building large scale Node applications on AWS Lambda for years.

One function per lambda never held up at any real scale. Once you have hundreds of them the
deployment sprawls and nobody can say what handles what.

Grouping code by business logic instead of by AWS service worked much better. An entity lives in one
place, whether it arrives over HTTP or off a queue.

I could never find a framework that was comfortable with all of this. The ones I tried handled API
Gateway well and left every other event source to me. So I built this one.

## Source

The source lives on GitHub at [pyepye/lambda-event-router](https://github.com/pyepye/lambda-event-router).
