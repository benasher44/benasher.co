---
layout: post
title: 'Getting Started with Kotlin on iOS, Part 3: The Build'
tags: kotlin multiplatform kotlin/native ios swift
categories: software
description: An introduction to setting up your Kotlin multiplatform build for iOS.
---

Once you get your Kotlin multiplatform proof-of-concept in a working state, you'll want to get your build ready for integration into your team's workflow. This means CI that builds your library and runs the tests on every platform you support. This also means a build setup that allows playing with changes to your multiplatform library in a local debug build of your app. And finally, you'll want to distribute the library for consumption in your application. Now, each of those pieces could be its own article. My goal here is to help you understand the basics that, when put together, can be used to accomplish each of those goals.

Fundamental to getting this working is understanding what the various Gradle tasks do, which make your multiplatform build work. It's also important to dig into how Gradle tasks work in general, so you can better understand how to debug Gradle build issues, when they arise — a useful skill upgrading to a new version of the Kotlin Gradle plugin.

On top of that, I think you'll also start to understand how powerful Gradle is and begin to see how you can use it to automate all sorts of other tasks that are part of your build. And while you can get away with not diving into details about how Gradle tasks work for awhile, I promise that if you spend a bit of time on some of the recommended reading below, you'll wish you hadn't put it off.

## Gradle

For Kotlin multiplatform, the build works via Gradle and the [Kotlin multiplatform Gradle plugin](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html#setting-up-a-multiplatform-project). For iOS developers coming to Gradle for the first time, Gradle is like `xcodebuild`. But, instead of lots of build variables and a project file that defines your targets and configuration, in Gradle it's all defined in code. I found this a bit confusing and unfamiliar at first, but now that I understand it, I find that I enjoy Gradle's build tooling far more than what I get with Xcode.

The best advice I can give about learning Gradle is to read some of their documentation. Early on, my coworkers and I found we were able to make the most progress on debugging build issues after we had done some reading on [gradle.org](https://gradle.org) and [kotlinlang.org](https://kotlinlang.org) to understand some core Gradle and Kotlin multiplatform plugin concepts. To help with that, I've made a recommend reading list:

1. [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html): While IDEs like IntelliJ and Android Studio know how to interact with Gradle, it's helpful to know how to run tasks from the CLI, and you do that via the wrapper.
1. [Build Script Basics](https://docs.gradle.org/current/userguide/tutorial_using_tasks.html): Read up through "Task dependencies."
1. [Authoring Tasks](https://docs.gradle.org/current/userguide/more_about_tasks.html): Tasks are the basic building blocks of a Gradle build. Even if you never write a task, you'll understand how they work after this guide.
1. [Building Multiplatform Projects with Gradle](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html): Even if your project is already setup, your goal with this guide should be to understand targets, source sets, and maybe a bit about the Kotlin/Native-specific target DSLs and shortcuts.

### Gradle Tasks in a Kotlin Multiplatform Project

In your project, Gradle tasks are what make it go. They run your tests, build your debug builds, and it's what your CI will run to verify your build. Kotlin multiplatform projects turn the Gradle task complexity up to 11. So again, if you can spare the time, do as much of the recommended reading above as you can stand. From this point on, I'll assume some base knowledge of tasks

Something I often encounter on my team is folks, that are newer to multiplatform, running the "wrong" Gradle tasks. For example, someone will come to me with a build issue, and I'll find that this whole time they've been running the [`build`, `check`, or `assemble`](https://docs.gradle.org/current/userguide/base_plugin.html) tasks as part of their development workflow. On a project with fewer targets (i.e. only a JVM target), this is fine. In a multiplatform project, this is going to run the build and/or test tasks for all of the targets in your project that are supported by your machine. That can take a _lot_ of time.

Instead, find a target that works for you — maybe one that's for your preferred development platform. Then, let CI handle the final `check` across all of your targets. To see what any of these does on your machine, run (for example for `check`) `./gradlew check --dry-run`. You'll get a list of all of the tasks that `check` would invoke, and you can pick one from the list that makes sense for you. Read on for more info on decoding some of these task names.

## Building out CI

Alright so at this point, I'm going to assume you've done some of the recommended reading above. You understand what tasks are, how you use them to build your project, and that there are a lot of them in a Kotlin multiplatform project. If you don't have a project setup, you can clone [my bootstrap project](https://github.com/benasher44/KotlinMobileBootstrap) and run `./gradlew tasks` to see for yourself.

When getting started on CI work, I like to start by listing the high level steps that need to happen during the build. For PRs, there are two things we need to do:

1. Build the project
1. Run tests for the project

If those two things run without error, the build is passing. With multiplatform, this becomes complicated by the number of platforms you support. This might mean setting up some kind of build [matrix](https://docs.travis-ci.com/user/build-matrix/)-[type](https://help.github.com/en/actions/configuring-and-managing-workflows/configuring-a-workflow#configuring-a-build-matrix) [setup](https://docs.microsoft.com/en-us/azure/devops/pipelines/get-started-multiplatform?view=azure-devops) where these steps run on multiple operating systems for each platform.

In many cases, it's easy enough to just run `build`. From [the docs](https://docs.gradle.org/current/userguide/base_plugin.html#sec:base_tasks):

> Intended to build everything, including running all tests, producing the production artifacts and generating documentation…

If you're in a hurry, `build` will get the job done, and for small projects, this [is enough](https://github.com/benasher44/uuid/blob/297d2f038d93cae6fce976b15ed922429c4cab62/.github/workflows/pr.yml#L61).

### Too Much `build`

However, be aware that in cases where you're running your build on multiple operating systems, the `build` task on its own can be wasteful. Let's say your multiplatform project has a JVM target. Well, if your macOS and linux environments both support JVM, then running `build` in all environments during CI is going to run your JVM build twice. If you don't need that, consider running the `macosTest` and `jvmTest` tasks explicitly in separate environments to reduce your build times. Again, use `--dry-run` to dig into what your `build` actually does, so you can figure out a separation of environment-specific tasks that works for you.

## Kotlin Multiplatform Task Cheat Sheet

Figuring out the right tasks to run in the right environments takes some tinkering and opinions on what you want your build to validate. This is true for both CI and local development. There are a lot of tasks to choose from, but you can boil them down to just a few "task templates," if you will, once you understand how they work.

First, there are two variables to consider: configuration (sometimes called variant I think?) and target. Configuration can be either "Debug" or "Release". Target is the name of one of your targets (e.g. JVM). These variables are mixed with verbs to create the task names that make up your multiplatform project. For example, `<target>Test` is the format of all of the test tasks, so if you know the names of the targets in your project, you now also know the names of all of the test tasks. With that in mind, here is a bit of a cheat sheet that maps out the kinds of tasks you can run (follow along by running `./gradlew tasks` in your project):

- Run tests for a target: `<target>Test`
- Compile Kotlin for a target: `compileKotlin<Target>`
- Links (and produces) a Kotlin/Native framework (from your binaries DSL): `link<Configuration>Framework<target>` (replace `Framework` with other binary types)

With that, you should be able to figure out which Gradle tasks make sense for your build. Be warned, the Android Gradle Plugin (if that's part of your project) adds loads more tasks that look kind of like these, but they may not always fit into the above formulas.

## iOS Fat Framework

When you're sharing your multiplatform build with an iOS team, you may end up coming across this "fat" framework concept. In [KotlinMobileBootstrap](https://github.com/benasher44/KotlinMobileBootstrap), I have a special task that I created that inherits from [FatFrameworkTask](https://kotlinlang.org/docs/reference/building-mpp-with-gradle.html#building-universal-frameworks). Back over in Xcode-land, we're expecting a framework that will work with our build on both iOS simulator _and_ device. Those link tasks I mentioned above will only produce frameworks for one or the other. To get a framework that works for both, which is called a "fat" or "universal" framework, we have the `debugFatFramework` task (another could also be created for the release configuration).

You can tell which kind of framework you have and which architectures are embedded by running the `file` command on the binary in the framework. For example, running `./gradlew linkDebugFrameworkIosX64` in and then `file ./build/bin/iosX64/debugFramework/KotlinMobileBootstrap.framework/KotlinMobileBootstrap` (on the output) yields

> ./build/bin/iosX64/debugFramework/KotlinMobileBootstrap.framework/KotlinMobileBootstrap: Mach-O 64-bit dynamically linked shared library x86_64

You can see that it only has the slice for the iOS simulator. But, if we do `./gradlew debugFatFramework` and then `file build/fat-framework/debug/KotlinMobileBootstrap.framework/KotlinMobileBootstrap`, you'll see that it has the slices for both iOS simulator and device.

Okay so getting back to CI, this fat framework thing is something we want to think about. If your team is expecting a working fat framework, it's a good idea to run these tasks during your build to add to what "passing" means for you and your team.

## Putting it all Together

The hardest part of getting all of this working is that there is no one best way to setup your build tooling to accomplish the goals of CI and a local development workflow. You may not find the answer by doing a quick web search. Instead, you have to figure out how best to use the tools you have for the different parts of the build that are a part of your team's build setup.

At Autodesk, we use a homegrown CocoaPods setup that works for local development and distribution. We distribute our library as a [private pod](https://guides.cocoapods.org/making/private-cocoapods.html), which is configured to present the multiplatform framework as a [vendored framework](https://guides.cocoapods.org/syntax/podspec.html#vendored_frameworks). I may do another post all about that. However, I hope you can now use some of the information here about Gradle tasks to produce a framework that will work as a CocoaPods vendored framework, if that's something you're interested in. For the local setup, the Kotlin/Native [CocoaPods plugin](https://github.com/JetBrains/kotlin-native/blob/master/COCOAPODS.md) is worth a look. Happy building!