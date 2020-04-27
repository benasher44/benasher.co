---
layout: post
title: 'Getting Started with Kotlin on iOS, Part 3: The Build'
tags: kotlin multiplatform kotlin/native ios swift
categories: software
description: An introduction to setting up your Kotlin multiplatform build for iOS.
---

Once you get your Kotlin multiplatform proof-of-concept in a working state, you'll want to get your build ready for integration into your team's workflow. This means CI that builds your library and runs the tests on every platform you support. This also means a build setup that allows playing with your multiplatform library changes in a local debug build of your app. And finally, we want to distribute the library for consumption in our application.

The hardest part of getting all of this working is that there is no one best way to setup your build tooling to accomplish these goals. Instead, you have to figure out how best to use the tools you have for the different parts of the build that are a part of your team's build setup.

## CI Tools

At Autodesk, we use a variety of tools in our build, which are layered by loose responsibility (from highest to lowest layer):

1. [Jenkins](https://www.jenkins.io) (sorry not sorry): CI
1. [Fastlane](https://fastlane.tools): automation
1. [Xcode](https://developer.apple.com/xcode)/[Gradle](https://gradle.org): build

Many teams may not have that middle automation layer. It's not needed for what I'm going to discuss here, but it does serve as a useful platform for sharing automation logic (e.g. post on the ticket that a build with the fix is available) across stacks. Though, I will call out that fastlane has fanstastic support for [Gradle](https://docs.fastlane.tools/actions/gradle/) and [Xcode](https://docs.fastlane.tools/actions/xcodebuild/).

For the multiplatform build, I'm going to focus on the build layer because it's one of the concrete bits I can discuss. For the other layers, you'll have to work out how to integrate those parts into your own CI and automation tools.

## Gradle

For Kotlin multiplatform, the build works via Gradle and the [Kotlin multiplatform gradle plugin](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html#setting-up-a-multiplatform-project). For iOS developers coming to Gradle for the first time, Gradle is like `xcodebuild`. But, instead of lots of build variables and a project file that defines your targets and configuration, in Gradle it's all defined in code. I found this a bit confusing and unfamiliar at first, but now that I understand it, I find that I enjoy Gradle's build tooling far more than what I get with Xcode.

The best advice I can give about learning Gradle is to read some of their documentation. Early on, my coworkers and I found we were able to make the most progress on debugging build issues after we had done some reading on gradle.org and kotlinlang.org to understand some core Gradle and Kotlin multiplatform plugin concepts. To help with that, I've made a recommend reading list:

- [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html): While IDEs like IntelliJ and Android Studio know how to interact with Gradle, it's helpful to know how to run tasks from the CLI, and you do that via the wrapper.
- [Build Script Basics](https://docs.gradle.org/current/userguide/tutorial_using_tasks.html): Read up through "Task dependencies."
- [Authoring Tasks](https://docs.gradle.org/current/userguide/more_about_tasks.html): Tasks are the basic build blocks of a Gradle build. Even if you never write a task, you'll understand how they work after this guide.
- [Building Multiplatform Projects with Gradle](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html): Even if your project is already setup, your goal with this guide should be to understand targets, source sets, and maybe a bit about the Kotlin/Native-specific target DSLs and shortcuts.

### A Note about Gradle Tasks and Kotlin Multiplatform Setups

One thing I see folks struggle with quite a bit on my team is running the "wrong" Gradle tasks. Wrong is in quotes there because it's subjective. For example, I'll find that this whole time an iOS dev has been running the [`build`, `check`, or `assemble`](https://docs.gradle.org/current/userguide/base_plugin.html) tasks all the time as part of their development workflow. On a project with fewer targets (e.g. only JVM target) involved, this might be okay, but in a multiplatform project, this is going to run the build and/or test tasks for all of the targets in your project that are supported by your machine. That can take a lot of time. Instead, find a target that works for you, and let CI handle the final `check` across all of your targets. To see what any of these does on your machine, run `./gradlew check --dry-run`. You'll get a list of all of the tasks that `check` would invoke.

## CI for PRs

Alright so at this point, I'm going to assume you've done some of the required reading above. You understand what tasks are, how you use them to build your project, and that there are a lot of them in a Kotlin multiplatform project. If you don't have a project setup, you can clone [my bootstrap project](https://github.com/benasher44/KotlinMobileBootstrap) and run `./gradlew tasks` to see for yourself.

When getting started on CI work, I like to start by listing the high level steps that need to happen during the build. For PRs, there are two things we need to do:

1. Build the project
1. Run tests for the project

If those two things run without error, the build is passing. With multiplatform, this becomes complicated by the number of platforms you support. This might mean setting up some kind of build [matrix](https://docs.travis-ci.com/user/build-matrix/)-[type](https://help.github.com/en/actions/configuring-and-managing-workflows/configuring-a-workflow#configuring-a-build-matrix) [setup](https://docs.microsoft.com/en-us/azure/devops/pipelines/get-started-multiplatform?view=azure-devops) where these steps run on multiple operating systems for each platform.

In many cases, it's easy enough to just run `build`. From [the docs](https://docs.gradle.org/current/userguide/base_plugin.html#sec:base_tasks):

> Intended to build everything, including running all tests, producing the production artifacts and generating documentation…

If you're in a hurry, `build` will get the job done, and for small projects, this [might be enough](https://github.com/benasher44/uuid/blob/297d2f038d93cae6fce976b15ed922429c4cab62/.github/workflows/pr.yml#L61).

### Too Much `build`

In cases when you're running your build on multiple operating systems, `build` on its own can be wasteful. Let's say your multiplatform project has a JVM target. Well, if your macOS and linux environments both support running JVM, then `build` is going to run your JVM build twice. If you don't need that, consider running the `macosTest` and `jvmTest` tasks explicitly in separate environments to reduce your build times. If you're going to separate out your build and test tasks.

### Kotlin Multiplatform Task Cheat Sheet

Figuring out the right tasks to run in the right environments takes some tinkering and opinions on what you want your build to validate. There are a lot of tasks to choose from, but you can boil them down to just a few general tasks, if you understand how they work. There are two variables to consider: configuration (sometimes called variant I think?) and target. Configuration can be either "Debug" or "Release". Target is the name of one of your targets. For example, `<target>Test` is the format of all of the test tasks, so if you know the names of the targets in your project, you now also know the names of all of the test tasks. With that in mind, here is a bit of a cheat sheet that maps out the kinds of tasks you can run (`./gradlew tasks` and `./gradlew <task> --dry-run` are your friends here):

- Run tests for a target: `<target>Test`
- Compile Kotlin for a target: `compileKotlin<Target>`
- Links (and produces) a Kotlin/Native framework (from your binaries DSL): `link<Configuration>Framework<target>` (replace `Framework` with other binary types)

With that, you should be able to figure out which Gradle tasks make sense for your build.

## iOS Fat Framework

In [KotlinMobileBootstrap](https://github.com/benasher44/KotlinMobileBootstrap), we have a special task that we created that inherits from [FatFrameworkTask](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html#building-universal-frameworks). Back over in Xcode-land, we're expecting a framework that will work with our build on both iOS simulator _and_ device. Those link tasks I mentioned above will only produce frameworks for one or the other. To get a framework that works for both, which is called a "fat" or "universal" framework, we have the `debugFatFramework` task (another could also be created for th release configuration).

You can tell which kind of framework you have and which architectures are embedded by running the `file` command on the binary in the framework. For example, running `./gradlew linkDebugFrameworkIosX64` in and then `file ./build/bin/iosX64/debugFramework/KotlinMobileBootstrap.framework/KotlinMobileBootstrap` (on the output) yields

> ./build/bin/iosX64/debugFramework/KotlinMobileBootstrap.framework/KotlinMobileBootstrap: Mach-O 64-bit dynamically linked shared library x86_64

You can see that it only has the slice for the iOS simulator. But, if we do `./gradlew debugFatFramework` and then `file build/fat-framework/debug/KotlinMobileBootstrap.framework/KotlinMobileBootstrap`, you'll see that it has the slices for both iOS simulator and device.

Okay so getting back to CI, this fat framework thing is something we want to think about. If your team is expecting a working fat framework, it's a good idea to run these tasks during your build to add to what "passing" means for you and your team.

## Internal Distribution