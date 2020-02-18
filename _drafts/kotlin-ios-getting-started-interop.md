---
layout: post
title: 'Getting Started with Kotlin on iOS, Part 2: Interop'
tags: kotlin multiplatform kotlin/native ios swift
categories: software
description: An introduction to interop between Kotlin and Swift in Kotlin multiplatform.
---

###### Co-authored by [Phill Farrugia](https://github.com/phillfarrugia)

After you get a [feel for the language](https://benasher.co/kotlin-ios-getting-started/) and do some [Koans](https://play.kotlinlang.org/koans/), the next step in your journey to writing Kotlin for iOS is understanding what that Kotlin is going to look like from the Swift in your iOS app. The way that Kotlin reverse interop (Swift talking to Kotlin) works is via Objective-C. For some, discovering that they get an Obj-C header from their Kotlin library, instead of a Swift one, is disappointing. That’s an understandable reaction. In a all (or majority) Swift code base, you and your team may have spent a lot of time building out your project using all that Swift has to offer– even the stuff that’s not compatible with Obj-C.

## But my Swift!

The first thing to understand here is that Kotlin/Native–the member of the Kotlin multiplatform family responsible for this part–predates the Swift language features like Swift ABI, and module ABI, stability that would make Swift-only reverse interop for Kotlin possible. We know, and JetBrains knows, that Apple now has (some) Swift-only system frameworks now, and Apple’s ecosystem is moving in that direction. If JetBrains wants developers to [build iOS (and Android) apps in Android Studio](https://blog.jetbrains.com/kotlin/2019/12/what-to-expect-in-kotlin-1-4-and-beyond/) this year, I think we can expect Swift reverse interop in the future 🙏.

For now though, what you get when you build a Kotlin library into an Obj-C framework is one with a header that is well-annotated for Swift. Phill and others on our team that were getting their hands dirty with our Kotlin-based framework didn’t realize–until they looked under the hood–that the classes they were interacting with were Obj-C. For what it’s worth, this is the status quo with the majority of Apple’s system frameworks that you interact with in Swift right now. You get an Obj-C framework that is annotated to feel “Swifty”.

## Kotlin Visibility

The next step to writing your own Kotlin library is understanding visibility. Like Swift, Kotlin has [visibility modifiers](https://kotlinlang.org/docs/reference/visibility-modifiers.html) for top-level declarations: `public`, `internal`, and `private`. By default, everything is `public` 😱. It’s therefore good to get into the habit of marking your classes as `internal` until you’re sure you want your API to be used by your downstream application. There’s no cost to keeping an API hidden, but I assure you that your colleagues in other timezones (👋 Tel Aviv) will not be happy when they wake up, pull, and find breaking changes 😇.

For reasons like that, JetBrains recommends in [their Coding Conventions](https://kotlinlang.org/docs/reference/coding-conventions.html#coding-conventions-for-libraries) that library authors “always explicitly specify member visibility.” Be on the lookout in a future Kotlin release for [“API mode”](https://youtrack.jetbrains.com/issue/KT-36016), which will allow you run the compiler in a mode that will generate warnings when visibility isn’t explicit 🙌.

## Kotlin to ~~Swift~~ Obj-C

A good starting place to understand what you’re going to get when you export your library to an Obj-C framework is [this one-pager on Kotlin and Obj-C/Swift interop](https://kotlinlang.org/docs/reference/native/objc_interop.html). We’re starting from a good place: `List<String>` in Kotlin gets you `NSArray<NSString>` in Obj-C and `[String]` in Swift, for example. `class` in Kotlin is `class` in Swift. `interface` is `protocol`. If you don’t read the whole guide, scan over the table at the top to get a quick understanding of what you can expect to get when exporting your Kotlin.

To make the interop work, Kotlin/Native generates some base-layer (for lack of a better term) code in your framework to make this translation work well between Swift and Kotlin. Let’s take a look at [KotlinMobileBootstrap](https://github.com/benasher44/KotlinMobileBootstrap/)’s framework output. Clone the repository, and run `./gradlew debugFatFramework`. If all goes well, you should end up with a framework at `build/fat-framework/debug/KotlinMobileBootstrap.framework` (relative to the repository root). If you then crack open the framework’s header, you’ll see a healthy list of base classes. All of your types will inherit from these, and you may see more depending on what all you export in your framework (e.g. an added base class for Kotlin’s enum type). Here are some of the types in KotlinMobileBootstrap:

- `@interface KotlinBase : NSObject`
- `@interface KMBMutableSet<ObjectType> : NSMutableSet<ObjectType>`
- `@interface KMBMutableDictionary<KeyType, ObjectType> : NSMutableDictionary<KeyType, ObjectType>`
- `@interface KMBNumber : NSNumber`
- `@interface KMBBoolean : KMBNumber`

You won't find these in your actual Kotlin code. They're generated when creating the Obj-C framework. The overarching reason we need all of this is to ensure smooth interop between the Swift/Obj-C world and the Kotlin one. To pick an example, one of Kotlin’s promises is working in your application without the help of the JVM, yet Kotlin/Native has to have working [automatic memory management](https://github.com/JetBrains/kotlin-native/blob/master/FAQ.md#q-what-is-kotlinnative-memory-management-model). Among other things, `KotlinBase` allows the memory management environments of Kotlin/Native and Swift to work together without help from me and you. I won’t get into how their automated memory management works in detail (could be a post in itself if I had the expertise), but it’s one of the concerns [Alec Strong](https://twitter.com/strongolopolis) addresses in [our talk from KotlinConf 2019](https://bit.ly/basher_kotlinconf_2019).

You also might notice lots of `__attribute__((swift_name("SwiftyNameHere")))` sprinkled throughout the header. If you haven’t worked with making Obj-C APIs feel “Swifty” before, this is the mechanism for making an Obj-C-sounding declarations look and feel “Swifty” when interacting with them in Swift. Obj-C will see the classes and methods as is, and Swift will see the string inside the `swift_name` part.

Now that we have some of those basics covered, it’s time to write some Kotlin. Phill is going to walk through how some of the basic Kotlin constructs come out on the other end and appear to Swift.

## Class

One of the most common features of the Kotlin language you’ll work with is a class, which for the most part works exactly as you would expect it to in Swift and Obj-C. Define a class (or a data class) `Sample` in Kotlin and a corresponding class will be defined in Obj-C. 

{% highlight kotlin %}
class Sample
{% endhighlight %}

{% highlight objective-c %}
__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("Sample")))
@interface KotlinIos2Sample : KotlinBase
- (instancetype)init __attribute__((swift_name("init()"))) __attribute__((objc_designated_initializer));
+ (instancetype)new __attribute__((availability(swift, unavailable, message="use object initializers instead")));
@end;
{% endhighlight %}

Notice that generated Obj-C classes inherit from the `KotlinBase` super class, which subsequently inherits from NSObject. Generated classes are prefixed with a prefix that is derived from the framework name, in this case “KotlinIos2”. Each class includes type annotations in order to make class names, methods and initializers look and behave natively to Swift language conventions.

### Inheritance

// Code Block demonstrating open class?

Since classes in Kotlin are final by default, their native counterpart is annotated to restrict subclassing with `__attribute__((objc_subclassing_restricted))`. By specifying open on your Kotlin class, the generated Obj-C class will also support inheritance.

### Protocol Conformance

Conforming your class to an interface in Kotlin outputs protocol conformance in the public header of the generated Obj-C.

// Protocol conformance in Objc header code block

### Initializers

Using Kotlin’s primary constructors to define a set of parameters directly after the class name `class MyClass(val str1: String, val str2: String)` will generate a designated initializer in Obj-C. It will also generate @property members on the public interface of the class, marked with `readonly` if defined as a `val`, or not if the property is a `var`.

// Kotlin primary constructor code block

Initializers and functions will concatenate parameter names into an Obj-C-friendly camel case method name, such as `initWithStr2:str2:` and provide a more concise Swift-friendly function annotation.

// Objective C class with a designated initializer

## Value Types

Coming from the world of Swift where you might often find yourself defining structs, you’ll quickly notice that the Kotlin language doesn’t have value types. Instead the next best thing is a data class which is typically used as a mechanism to hold data in a series of properties. Data classes allow the compiler to derive members such as `equals()`, `hashCode()`, `toString()` and `copy()` on your object.

// Data class defined in Kotlin

If you define a data class in Kotlin, you’ll see that these derived methods are implemented as their Obj-C counterparts on NSObject such as `isEqual`, `hash`, and `description`.

// Objective C class with isEqual/hash/description

## Function Calls

TBD

## Enums

Enums in Kotlin are just classes, but they’re a special kind of class that work in much the same way as they do in Swift. Although when you define an enum in Kotlin and peek at the Obj-C generated header, you may not see what you thought you’d see.

{% highlight kotlin %}
enum class MyEnum { CASE1, CASE2 }
{% endhighlight %}

{% highlight objective-c %}
__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MyEnum")))
@interface KotlinIos2MyEnum : KotlinIos2KotlinEnum
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer)) __attribute__((unavailable));
@property (class, readonly) KotlinIos2MyEnum *case1 __attribute__((swift_name("case1")));
@property (class, readonly) KotlinIos2MyEnum *case2 __attribute__((swift_name("case2")));
- (int32_t)compareToOther:(KotlinIos2MyEnum *)other __attribute__((swift_name("compareTo(other:)")));
@end;
{% endhighlight %}

Interestingly since enums in Kotlin are classes, Kotlin/Native generates an Obj-C class with each enum case defined as a readonly class property on the type. This generated class inherits from the KotlinEnum superclass, which is another generated class that utilizes Obj-C lightweight generics to implement base enum functionality such as case comparison, equality and initialization.







