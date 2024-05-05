---
layout: post
title: Leaving Mobile for Web
tags: kotlin multiplatform mobile web node javascript typescript iOS Xcode
categories: software
description: A reflection on leaving iOS development for web
---

I wrote my last post about a month before I left Autodesk (what may be my last iOS development role). After 10 years of doing iOS development in some form, I got an opportunity to switch to web at another company, and I took it.

## How I got here

I started in iOS development because I was in college (2009-2013) getting my CS degree during the heyday of the App Store. I joined [Mobiata](http://mobiata.com/) as one of their first interns, where I worked on mobile travel apps like FlightTrack and FlightBoard. It was an exciting time! While I was in class learning how to write algorithms in C, I was also building an app that I could CARRY AROUND ON MY PHONE that told me when the next University of Michigan bus would arrive (worked on a public XML feed at the time). This was nothing short of amazing.

Then there were the WWDCs. If I was ever feeling any kind of boredom around iOS development, attending WWDC (and/or the alt confs) would usually provide the shot of adrenaline I needed to carry me through to the next one. Meeting folks in the community and discussing all of the "new things you could do now" with the latest updates was intoxicating. Each time, it almost revived the original novelty of when I first launched BenBus (what my friends lovingly called my original bus app).

Toward the end of my iOS career, I stumbled upon Kotlin. I had heard about it plenty, having always worked alongside Android developers. They loved Kotlin, but I got to use it myself in an iOS context. I had been tasked with coming up with a way to not have us rewrite parts of the sync engine (mostly just logic + marshaling JSON + sqlite) across the 3 platforms that PlanGrid supported: iOS, Android, and Windows. After a bit of research, I found Kotlin Multiplatform, which I have written about a fair bit.

## Community tooling

As I was building a multi-platform sync engine at PlanGrid in Kotlin, I kept having this thought of “wow I like writing Kotlin way more than Swift.” It wasn’t the language itself though — more the experience of the work. I began to realize it was having open tooling and an ecosystem with community support. If I got stuck, there was no need to decompile a binary or read a blog post about somebody who had decompiled the binary first. The tooling and SDKs were (for the most part) open source, down to the build system.

The build system, gradle, has you write code for configuration, which means the build system had its own SDK, with documentation. This was such a huge contrast to Xcode (in mid-2021 — am not up-to-date on latest Xcode capabilities), which had you insert shell scripts at various build phases (as the mode of customization). While one could argue that shell scripting is the ultimate flexibility, after trying gradle (also an imperfect system people complain about!), I was sold on the idea that build phases could be programmable with their own API and documented way of telling the system whether they needed to be re-run, could be skipped, etc.

The other amazing part about all of this (again coming from the Xcode world) was that if I ever had a problem whose root cause was in some library the build system relied upon, I could almost always file a bug somewhere in the open, or open a PR to fix it myself. Someone in the open would almost always fix it, or there would be a workaround that required a small snippet of build system code that I could drop into my configuration, until the issue was fixed.

## More than the build system

The build system parts that make Kotlin Multiplatform builds work are a metaphor unto themselves. There’s gradle, which is the core build system. Companies and the community build plugins that work on top of gradle to make the various build phases work. In the end, you have a happy (albeit sometimes messy!) result. And at no step of the way is anyone hiding the ball (for the next annual release); everyone has the same goal, which is to work together on a tool that lets everyone get work done.

I was enjoying working with Kotlin because I was enjoying working in an ecosystem that didn’t get in my way. Best of all, I didn’t have to wait for the annual update to see my problems fixed or not fixed. I came to work 8 hours a day, and Kotlin was right there with me. There was no App Store to “protect,” no IP to hide, and no annual release to wait for. I just got to code (for the most part).

## Time to go

After seeing how quickly the Kotlin ecosystem had moved (in the ~2 years I had been a part of it), it became excruciating to look back at the iOS world. After experiencing the pace and flow outside of Apple’s walled garden, I felt I might be dead by the time I saw any of my radars fixed.

## Today

In my new job, I do a lot of backend work in TypeScript (JavaScript with a type checker) with node as the runtime. JavaScript-based web development has more similarities than you might think to iOS development. In both worlds, you have to think about the different runtimes your code supports. In web land for example, I have to think about whether my JS will run on node vs in a browser. I might also have to consider whether the supported browser variants support the language features I want to use. As mobile developers supporting different devices and OS versions, we've seen this movie before.

Despite the JavaScript ecosystem's popularity and relative openness, I once saw a job posting that highlighted how you “don’t have to deal with node” there. I wish I had saved a screenshot of it. It’s kind of funny, but it’s also interesting because it’s part of an ad (for a job). It hits on the emotional connection you have with your work and the way developer tooling impacts your day-to-day experience.

In the years since I left Autodesk, I've been working at [Ashby](https://ashbyhq.com) (with a lot of my former iOS teammates from PlanGrid/Autodesk!) building a relationship with a new stack. Working in a stack based on TypeScript end-to-end has been great, and I think it’ll hold me over another 10 years.