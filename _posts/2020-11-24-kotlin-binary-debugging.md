---
layout: post
title: Debugging Binary Kotlin Frameworks
tags: kotlin multiplatform kotlin/native ios swift debugging Xcode
categories: software
description: A look at distribution of a Kotlin multiplatform library via CocoaPods
---

When getting Kotlin integrated into your iOS and Android teams' workflows, something you will need to tackle is figuring out how to debug your iOS-ready Kotlin from Xcode. This quest may lead you to some of the following resources:

- Kevin Galligan's post: [Debugging Kotlin on iOS with Xcode](https://dev.to/touchlab/debugging-kotlin-on-ios-with-xcode-37fd)
- Touchlab's GitHub resources for doing this, such as [xcode-kotlin](https://github.com/touchlab/xcode-kotlin/)

At Autodesk, engineers aren't always working alongside a Kotlin framework that was built from local sources. Often, many of us are testing our latest Swift code, which links against the pre-built binary version of the framework that was built by CI and downloaded and installed from a remote location via CocoaPods (podspec checked into a private specs repo). We do this for a few reasons:

1. Early on, this meant we could test out Kotlin multiplatform without requiring that other iOS engineers have a certain Java setup to run a local build. To the unaware iOS engineer, it just looked like we added another CocoaPod that installs a binary framework— one of many.
1. Even if you are someone on the team that often does work in our shared Kotlin code, using a pre-built binary means you can skip a whole build step (building Kotlin into an iOS framework).

If you follow all of the advice from Kevin and Touchlab's available documentation and use their plugins, then you should find yourself with a working setup that allows you to debug Kotlin built from source on your machine. This is exciting! You now have a basic working "dev setup."

Now, let's say you're working with the pre-built version of your Kotlin framework. All of a sudden, you find a bug! You do some initial debugging, and you come to the conclusion that, yes, this bug is in the Kotlin code somewhere. To get this sorted out, you will need to get your new "dev setup" back into place:

1. Figure out what version of the Kotlin code you were using, and check that out.
1. Follow the above-linked guidance, and get Xcode building your Kotlin from source.
1. Wait anywhere from 1 to 5 minutes for your Kotlin build to finish.
1. Wait some more, while Xcode finishes its rebuild.
1. Come back 20 minutes later because you answered a Slack message and forgot you were doing all of the above.

Now that it has been about 30 minutes, you resume debugging, fix the bug, rebuild to verify it, (answer more Slack messages in between), verify the fix, and then PR and push a patch. Now that you're done, you can go back to what you were working on before when you encountered the bug, which was what again? Oh shoot it's the end of the day— try again tomorrow.

## Debugging from the Binary

If this sounds miserable, you are right! Slack relationship issues aside, there is a better way. You can debug a binary pre-built from CI. The whole reason we have to debug using Kotlin that was built from local sources in the first place is because dSYM bundles (which enable Xcode to map binary function addressses to your sources and therefore enable your breakpoints) contain references to your sources that contain absolute paths from the machine that built the framework and dSYM. You can set all of the break points you want, but Xcode won't be able to figure out that `/var/lib/jenkins/YourLibrary/src/commonMain/kotlin/MyClass.kt` referenced in the dSYM built by your CI machine is `~/Code/YourLibrary/src/commonMain/kotlin/MyClass.kt` on your local machine.

The good news though is that there is away to make Xcode and LLDB understand just that. Apple has a page [here](https://opensource.apple.com/source/lldb/lldb-179.1/www/symbols.html) that explains that you can embed a plist file in your dSYM bundle that tells LLDB (run by Xcode) how to map absolute paths in your dSYM to those on your machine. Here's their example plist:

{% highlight xml %}
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
   <key>DBGArchitecture</key>
   <string>i386</string>
   <key>DBGBuildSourcePath</key>
   <string>/path/to/build/sources</string>
   <key>DBGSourcePath</key>
   <string>/path/to/actual/sources</string>
   <key>DBGDSYMPath</key>
   <string>/path/to/foo.dSYM/Contents/Resources/DWARF/foo</string>
   <key>DBGSymbolRichExecutable</key>
   <string>/path/to/unstripped/exectuable</string>
</dict>
</plist>
{% endhighlight %}

I won't spend too much time in here, but we can eyeball the plist and see that there's a key called `DBGBuildSourcePath` and `DBGSourcePath`, which together create the mapping we want (from CI sources to local sources). If you read through the Apple page a bit, you'll find that once such plist per architecture included in your binary is needed to make this work. Each file is named `<UUID>.plist` with the UUID that identifies the architecture slice in your binary (`dwarfdump --uuid <path_to_framework_binary>` to see these).

Stepping back a bit, our goal is to be able to debug our pre-built Kotlin framework from Xcode, which we can't do (without making some changes) because the dSYM we have with our framework contains absolute paths on a machine (the CI machine that built the framework) that isn't our local machine. To make this work we need to:

1. Generate a plist that maps absolute paths from the CI machine to ones that work on our local machine.
1. Repeat this once per architecture slice included in our framework.
1. Name those based on the UUID (ick) of said architecture slices.
1. Place them in the dSYM bundle for our framework.

## Automating the UUID Plists

When I was first digging into this problem, I came to realize that any of this was solvable at all by stumbling upon Max Raskin's [post](https://medium.com/@maxraskin/background-1b4b6a9c65be) on the subject. Max (who now happens to be one of my colleagues) wrote this post addressing the same issue but for a C++ library. As it turns out, this problem has nothing to do with Kotlin. It's a general problem in this (Apple?) ecosystem for binary libraries. [Here's a bug](https://bugs.swift.org/browse/SR-11661) discussing these plists in the Swift bug tracker, for example (another non-Kotlin context). In Max's case, it's used to help debug a binary C++ library. In our case, we're using it to debug a Kotlin binary framework.

If you read Max's article, you'll see that Max put together a nice python script that, when given paths to your framework, dSYM, and sources, will generate and output the plists you need, and put them in the right place. Max was also kind enough to include a reference to [my ruby port](https://gist.github.com/benasher44/fcf92fc12ff8b539bee7cc50fb52ed32) of the same script. On my team, everyone has a dependable ruby setup for CocoaPods, but that's not always the case for their python setups. So, I made this port.

To use either script and get this working:

1. Run the script and pass the paths to the binary framework, the dSYM, and a local checkout of the sources _that is the same version used to build the framework_ (some digging in git and cross-referencing with CI may be required to get this right). This will generate the plists and put them in the right place in your dSYM bundle.
1. [Create a folder reference in Xcode to your sources](https://github.com/touchlab/xcode-kotlin/issues/16).
1. Build and run your application.

If all goes well, Xcode should be able to stop on your Kotlin breakpoints, even though the binary was built on your CI machine. At Autodesk, we have this ruby script run in a [`post_install`](https://guides.cocoapods.org/syntax/podfile.html#post_install) hook during `pod install`, if you set an environment variable that contains the path to your local checkout of the Kotlin sources. Then, all you need to do when you want to debug is create that folder reference in Xcode. This saves us a lot of time and hassle, if we encounter a bug in our Kotlin while testing our applications. We no longer need to stop to reconfigure our setup to build from source, just to debug our Kotlin.

Give the ruby script a try, and leave a comment [in the gist](https://gist.github.com/benasher44/fcf92fc12ff8b539bee7cc50fb52ed32), if you run into issues.

Happy Kotlin debugging!
