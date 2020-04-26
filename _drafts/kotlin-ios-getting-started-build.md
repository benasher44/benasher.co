---
layout: post
title: 'Getting Started with Kotlin on iOS, Part 3: The Build'
tags: kotlin multiplatform kotlin/native ios swift
categories: software
description: An introduction to setting up your Kotlin multiplatform build for iOS.
---

Once you get your Kotlin multiplatform proof-of-concept in a working state, you'll want to get your build ready for integration into your team's workflow. This means CI that builds your library and runs the tests on every platform you support. This also means a build setup that allows playing with your multiplatform library changes in a local debug build of your app.

The hardest parts of getting all of this working is that there is no one best way to setup your build tooling to accomplish these goals. Instead, you have to figure out how best to use the tools you have for the different parts of the build that are a part of your team's build setup.

## CI Tools

At Autodesk, we use a variety of tools in our build, which are layered by loose responsibility (from highest to lowest layer):

1. [Jenkins](https://www.jenkins.io) (sorry not sorry): CI
1. [Fastlane](https://fastlane.tools): automation
1. [Xcode](https://developer.apple.com/xcode)/[Gradle](https://gradle.org): build

Many teams may not have that middle automation layer. It's not needed for what I'm going to discuss here, but it does serve as a useful platform for sharing automation logic (e.g. post on the ticket that a build with the fix is available) across stacks. Though, I will call out that fastlane has fanstastic support for [Gradle](https://docs.fastlane.tools/actions/gradle/) and [Xcode](https://docs.fastlane.tools/actions/xcodebuild/).

For the multiplatform build, I'm going to mainly focus on the build layer, in terms of concrete bits I can discuss. For the other layers, you'll have to work out how to integrate those parts into your own CI and automation tools.

## Gradle

For Kotlin multiplatform, the build works via Gradle and the [Kotlin multiplatform gradle plugin](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html#setting-up-a-multiplatform-project). For iOS developers coming to Gradle for the first time, Gradle is like `xcodebuild`. But, instead of lots of build variables and a project file that defines your targets and configuration, in Gradle it's all defined in code. I found this a bit confusing and unfamiliar at first, but now that I understand it, I find that I enjoy Gradle's build tooling far more than what I get with Xcode.

The best advice I can give about learning Gradle is to read some of their documentation. Early on, my coworkers and I found we were able to make the most progress on debugging build issues after we had done some reading on gradle.org and kotlinlang.org to understand some core Gradle and Kotlin multiplatform plugin concepts. To help with that, I've made a recommend reading list:

- [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html): While IDEs like IntelliJ and Android Studio know how to interact with Gradle, it's helpful to know how to run tasks from the CLI, and you do that via the wrapper.
- [Authoring Tasks](https://docs.gradle.org/current/userguide/more_about_tasks.html): Tasks are the basic build blocks of a Gradle build. Even if you never write a task, you'll understand how they work after this guide.
- [Building Multiplatform Projects with Gradle](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html): Even if your project is already setup, your goal with this guide should be to understand targets, source sets, and maybe a bit about the Kotlin/Native-specific target DSLs and shortcuts.

### A Note about Gradle Tasks and Kotlin Multiplatform Setups

One thing I see folks struggle with quite a bit on my team is running the "wrong" Gradle tasks. Wrong is in quotes there because it's subjective. For example, I'll find that this whole time an iOS dev has been running the [`build`, `check`, or `assemble`](https://docs.gradle.org/current/userguide/base_plugin.html) tasks all the time as part of their development workflow. On a project with fewer targets (e.g. only JVM target) involved, this might be okay, but in a multiplatform project, this is going to run the build and/or test tasks for all of the targets in your project that are supported by your machine. That can take a lot of time. Instead, find a target that works for you, and let CI handle the final `check` across all of your targets. To see what any of these does on your machine, run `./gradlew check --dry-run`. You'll get a list of all of the tasks that `check` would invoke.