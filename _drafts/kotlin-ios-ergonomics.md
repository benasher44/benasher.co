---
layout: post
title: 'An Ergonomics Review of Kotlin from Swift'
tags: kotlin multiplatform kotlin/native ios swift
categories: software
description: A review of using Kotlin from Swift— good parts and those that could use improvement.
---

At Autodesk, my colleagues and I are more than a year and a half into our Kotlin multiplatform shared library journey. That's one Kotlin shared library, shared amongst our three mobile platforms that we support for the PlanGrid app (iOS, Android, and Windows).

Most new feature development for the PlanGrid app starts in the shared library now. It has become so much an extension of our main application that we're planning a move to a mono-repo (iOS, Android, Windows, and the KMP shared library all in one place) later this year, which will help solve some of the scale issues (great problem to have all things considered).

## Making it Work

Looking back, there were a few things that made Kotlin work well for us that have to do with a combination of developer experience and our team. Early on, the few of us working on the proof-of-concept and pitching KMP to the rest of the team focused on developer experience. We ensured that integrating our experiment wouldn't get in the way of day-to-day work by distributing it as a binary framework via CocoaPods (already integrate other binary frameworks).

While testing out KMP-based functionality alongside all of the other work going on, we made use of feature flags in case shit hit the fan in production. Once we had our foot in the door, had proved things worked well, and had come up with a plan for how the library was going to evolve, the next step was getting people to adopt the shared library for their features.

Again, that takes us back to developer experience. Lucky for us, KMP comes with iOS interop out-of-the-box. It's so good that one of my colleagues thought they were using some kind of bridging layer that we must have wrote to make Kotlin feel Swift-y. When they command-clicked through to source, they were surprised to find the KMP-generatd shared library header.

### Having a Good Team Helps 

Did I mention we have a Windows team? For that side of things, we got lucky. The level of support from KMP you get for Windows does not measure up to iOS. On the Windows side, they would like to have a C# library in the style of the KMP-generated Obj-C library with nice generated headers. Instead, they get a library that uses C-interop— quite a different experience. Fortunate for us, a few folks on our Windows team were experienced and interested enough to write and maintain their own C# code generation on top of that. We hope to open source it later this year.

## Looking at Interop

To recap, these elements made it possible for KMP to work well for us:

1. Ease of integration on iOS and Android
1. Ergonomic interop out-of-the-box for iOS
1. Colleagues on our Windows team willing to take on the challenge of solving the interop issues there

If I could only pick one, it would be the interop on iOS that allowed this to become as successful as it has for us. It would be a much tougher sell, for example, had both the iOS and Windows teams needed to spend loads of effort on interop. At minimum, it would have delay its success for us.

My favorite example of this great interop is one from [the earlier post](/kotlin-ios-getting-started-interop/), where Phill and I wrote about the iOS interop:

{% highlight kotlin %}
// Kotlin
enum class LogLevel {
    ERROR,
    WARNING,
    INFO,
    DEBUG
}

class Logger {
    companion object default {
        fun log(level: LogLevel = LogLevel.ERROR, message: String, completion: (Boolean) -> Unit) { }
    }
}
{% endhighlight %}

{% highlight swift %}
// Swift
Logger.default.log(.error, "An error ocurred") {
    // Closure
}
{% endhighlight %}

This example highlights some idiomitic Kotlin that allows you to write idiomatic-looking Swift. It's impressive. However, this example has a secret. It also highlights many of the areas where Kotlin/Native interop with iOS needs improvement. With Kotlin 1.4.0 out the door, I hope now is a good time to raise these issues. Fixing them would take the sell to iOS teams to the next level, in terms of excellent interop. I'll discuss the issues in increasing in order of how long it took our teams to notice and bump into them.

### Exhaustive Enums

This is one of the earliest areas, for which I filed [an issue](https://github.com/JetBrains/kotlin-native/issues/2521) in the Kotlin/Native GitHub. Enums are a great way to describe an input for an API, such as the above log method. You run into problems with Kotlin enums as soon as you want to do an exhaustive `switch` (equivalent to exhaustive `when` in Kotlin) over them in Swift.

The problem lies in how enums are represented in Kotlin compared to Obj-C (remember Swift is irrelevant for comparison— interop is via Swift-y feeling Obj-C). Enums in Kotlin are reference types (a special `class`). In Obj-C, they're integers. Attempting to `switch` over them from Swift would be like trying to `switch` over an instance over any other class instance. The Swift compiler doesn't know that there happens to be a finite number of instances of that `enum class` like Kotlin does.

There is a workaround though that can improve the ergonomics a bit. You can define a matching C-style enum (with a matching name) and [redefine the ordinal property](https://github.com/JetBrains/kotlin-native/issues/2521#issuecomment-453009890) as having that type. At Autodesk, we do this with a bit of fragile (albeit has worked in our codebase with only one minor tweak since its creation) code generation that adds these C-style enums to the Obj-C framework header in Obj-C extensions on all of the enum types. With that, we get exhaustive `switch` for all of our Kotlin enums.

In the above sample code, you can see there's no problem passing enums around. You wouldn't have any idea about about Kotlin enums are represented, until you go to `switch` on one.

### Companion Objects

In [my first article](/kotlin-ios-getting-started/), I mentioned how, as an iOS developer, I found the `companion object` a bit strange at first, but I get it now. As my iOS colleagues have become better acquainted with them, we have begun to see them more often in our shared library. The problem comes if you don't know that you can name a `companion object`, like in the above example. Unnamed ones are more common, in my experience. Here is what the Swift code would look like, if we hadn't named the above `companion objecet` "default":

{% highlight swift %}
// Swift
Logger.Companion().log(.error, "An error ocurred") {
    // Closure
}
{% endhighlight %}

As someone who writes a lot of Swift, this looks funny at first. Are we creating a new `Logger.Companion`? If so, where can I see what this does in Kotlin? The ergonomics of the unnamed `companion object` is another issue [I filed early on](https://github.com/JetBrains/kotlin-native/issues/2757). To answer the question, [you aren't creating a new](https://github.com/JetBrains/kotlin-native/issues/2757#issuecomment-472866293) `Logger.Companion`.

The fix here isn't straightforward. You can convince your team to prefer naming a `companion object`, but that doesn't always make sense, if say your goal is to use a `companion object` to namespace a public constant. Solutions discussed in the ticket would be breaking changes. That said, I think improving ergonomics here would be an easy way to prevent less enthusiastic iOS developers from having this easy (and small) thing to point at. At Autodesk, we just acknowledge this quirk of the Obj-C export and move on. But, that's easy for us to do now, as we have a critical mass.

### Default Arguments

Although we bumped into this one later on, as we began to depend more on our shared library KMP-based APIs, a fix for this would make this biggest different for our team right now. If you notice in the above Kotlin, the log function has a default argument. However, you cannot use that default argument from Swift. As a log parameter, this might not be that important. In other contexts though, this could be a default integer parameter. In that case, it can be near impossible to know what argument you should pass in the "default" case. To avoid bugs, your best bet is to go back to the Kotlin source and find the answer.

I've heard folks complain though: but Swift supports default arguments, why shouldn't this work? This is often the first place folks begin to internalize that this doesn't matter. The interop is via Obj-C, so all that matters is what Obj-C supports. You can repeat this same answer for a bevy of similar complaints. `Interface` extensions? Swift supports the equivalent `protocol` extensions. Obj-C does not. Optional primitive types? Obj-C doesn't have those either. None of this is a knock on Kotlin/Native's interop, which again is great! Obj-C interop was the correct and stable choice at the time, as it was before Swift had a stable ABI. I made comments about this in my previous [interop article](/kotlin-ios-getting-started-interop/), but let's go back to the issue at hand.

Default arguments have a solution in Kotlin/JVM interop, which is used in hand-written Obj-C as well: [generated overloads](https://youtrack.jetbrains.com/issue/KT-38685). Generating overloads for C and Obj-C KMP libraries would be a huge improvement to Kotlin/Native's export facilities. I hope with Kotlin 1.4.0 out the door, time can be made for this one.

### Enums - Missing Exports

I want to go back to enums for a moment. I mentioned that I would review the issues in the order that my team ran into them. After getting more comfortable using Kotlin enums in our code, we began to come up with cases where we wanted to enumerate Kotlin enums. However, the needed `values()` function [is not exported to Obj-C by default](https://youtrack.jetbrains.com/issue/KT-38530). If you need this, you're left to define this yourself in your library that calls the stdlib equivalent. The workaround is fine, but it gets in the way, when the library you're using is one that's already packaged up and distributed. A fix requires another PR and waiting on another CI deploy.

### Translation to Obj-C Primitives

The final one I want to talk about is the most minor, but we do come across it on occasion. In the above example, we are hiding the fact that the completion closure has one parameter. It's a Kotlin `boolean`, but it is translated to Obj-C as a `KotlinBoolean` `class`. This is bound to happen if the type is optional. Again, Obj-C doesn't support optional primitives. In this case howeever, it's not. It should be a `BOOL` instead, which will translate to a `Swift` `Bool`.

In most cases, Kotlin/Native does the right thing, but there are occasions like this one that come across a bit clunky. I admit though, I don't have the expertise to understand why this happened in this case. Again, the interop you get for iOS is stellar. Fixing polish-type issues like this would take the interop to the next level.

### Interface Method Collisions

Okay I lied. There's one more quirk, but I felt that it didn't fit as well with some of the above issues. It is maybe a bit niche, and it depends on how you architect your code, as to whether or not you'll bump into this one. In our codebase, we create an `interface` for each of our repository classes. Let's say you have a repository like this one:

{% highlight kotlin %}
// Swift
interface FishRepository {
   fun fetchById(id: String): Fish?
}
{% endhighlight %}

Over time, other people on my team also add repositories with `fetchById` methods with the same name. Why not? `fetchById` is a reasonable thing to name that method. However, every time you add such a method, methods with the same name generated for Obj-C will get an underscore added to the end to disambiguate them from others. But why you ask? The explanation has to do again with Kotlin vs. Obj-C. Read [this issue](https://github.com/JetBrains/kotlin-native/issues/3293) for the full details. On of our `fetchById` methods is now up to seven underscores in Obj-C 😂.

If you have a look at the issue, there doesn't appear to be an easy solution from the Kotlin/Native side. What we've started doing is just naming our methods better. In this case, naming method `fetchFishById` should prevent this from happening most of the time. That said, it would be great if Kotlin/Native could emit a warning about such issues. That we can catch these during development, before the Obj-C export happens, and a random API gets an extra underscore (making the overall change breaking). Kotlin 1.4.0 has new native-specific frontend checkers. A new one that helped us out here would be most welcome.

## ❤️ Kotlin/Native

Kotlin/Native's interop for iOS is great, and it has allowed us to scale a shared codebase with little effort on the iOS side. That's a huge deal, when you consider that most of the mobile engineers that work on PlanGrid had to learn a new language for this to work. Again, I hope folks (including those at JB) don't read this as a knock on Kotlin/Native. These are just a few of the quirks that my team bumps into. Now that Kotlin 1.4.0 is out the door, I hope they can be address and take the interop to the next level.