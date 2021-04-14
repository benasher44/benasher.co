---
layout: post
title: An Interface for Multiplatform Networking
tags: kotlin multiplatform kotlin/native mobile networking ktor
categories: software
description: An approach to networking with Kotlin multiplatform
---

If you're starting a new Kotlin multiplatform mobile project, I think starting with ktor for your networking layer is a reasonable choice. If you're planning to add Kotlin multiplatform to an existing project, this may not be desirable for a couple of reasons:

1. Your application may already have a working networking layer, which itself may contain logic related to your API (e.g. authentication). Going with ktor means repeating or refactoring that logic in the shared multiplatform layer.
1. ktor will manage its own platform-specific networking client (e.g. `URLSession` on iOS). If your ktor-based networking stack and your application's "legacy" stack are making connections to the same hosts, you may end up with kept-alive connections to the same hosts in the connection pools managed by each stack (doubling your connections, depending on your platform).

Depending on your project, these issues may or may not matter to you, but with these ideas in mind, we (my team at Autodesk) took a stack-agnostic approach to multiplatform networking. In our multiplatform layer, we have an `interface` called `Network`, and it allows us to make network calls to our backend API. Here's a look at the `interface` itself. It started as this core method and a collection of supporting classes, though it has grown over time:

{% highlight kotlin %}
/** Defines the interaction between the library and the host app for making API requests */
public interface Network {

    /**
     * Makes an API request
     *
     * @param host The host, to which to make the request
     * @param request The request details
     * @param completion: The closure to call when the request is complete with the response
     */
    public fun makeRequest(
        host: APIHost,
        request: Request,
        completion: (Request.DataResponse) -> Unit
    ): NetworkDisposable
}

/** Helper for making coroutine-driven network calls */
internal suspend fun Network.makeRequest(host: APIHost, request: Request): Request.DataResponse {
    // Use deferred, so that we can capture coroutine cancellation
    // and use that to cancel our network request, if needed
    return threadSafeSuspendCallback { completion ->
        val requestCompletion: (Request.DataResponse) -> Unit = {
            completion(Result.success(it))
        }
        val cancellable = makeRequest(host, request, requestCompletion.freeze())
        return@threadSafeSuspendCallback { cancellable.cancel() }
    }
}


/**
 * Details of the network request
 */
public data class Request(

    /**
     * The request's path, starting with "/"
     */
    public val path: String,

    /**
     * A [Map] of the request's query parameters
     */
    public val queryParameters: Map<String, String>?,

    /**
     * The request's body, if any
     */
    public val body: String?,

    /**
     * The request's method
     */
    public val method: Method
) {
    init { freeze() }

    public enum class Method { GET, POST, PUT, DELETE, PATCH }

    /** The kinds of responses that can be returned by the host app */
    public sealed class DataResponse {

        /**
         * An HTTP response of in-memory data
         *
         * @param data The wrapped data
         * @param statusCode The status code of the network request. Expected to be in the success range.
         */
        public class Success(public val data: HTTPResponseData, public val statusCode: HttpStatusCode) :
            DataResponse() {
            init { freeze() }
        }

        /**
         * An error during the request
         */
        public class Failure(public val error: NetworkError) : DataResponse() {
            init { freeze() }
        }
    }
}
{% endhighlight %}

Starting at the top, we have `interface Network`, which defines a method for making a request to one of our API hosts, which are represented by an enum with cases for each of our internal API hosts (not shown here—each case maps to a host URI, which can change based on staging/production environment). The non-host parts of the request are represented by the `Request` class, and then the completion lambda is called with the response, when the request is finished. Making this call returns a handle to the request in the form of `NetworkDisposable` (definition omitted), which is an `interface` with a single method that can be called to cancel the request. Below that, you can see a sampling of the request and response classes. I left some definitions out for brevity, but hopefully you get the idea: a simple collection of classes to represent a basic HTTP request and response.

With these, you have each client application, who wants to use functionality of the multiplatform layer requiring network access, provide an implementation of `Network`. So instead of ktor, you just bring along a class that implements this `interface` and negotiates calls to your existing networking stack. In the PlanGrid app, we got started with this interface about two years ago, and it continues to serve us well, though we have added to it over time to support more use cases (e.g. downloading files). Here is a short list of things I like about it, which we take advantage of in our code:

1. With all of our multiplatform business logic that needs network access using `Network`, it's easy to write `Network` fakes in our tests that work across platforms.
1. We have a helper function that allows making a suspend-y network call. It's an internal extension function on `Network` (using [this](https://github.com/autodesk/coroutineworker#waiting-on-asynchronous-callback-based-work)) that allows internal code to use `Network` with coroutines, while on the outside (back on your native iOS/Android/Windows platform), all clients get an easy-to-support lambda-based API.
1. It doesn't make our decision on ktor final. With `Network` as this seam we have throughout our code, we can one day decide the time is right to swap out all of our platform-specific `Network` implementations for a single one based on ktor.

Like I said earlier, ktor may be the right choice for your project, but our choice to take this `interface Network` approach allowed us to get going on building the meat of our multiplatform business logic, fast. We continue to reap its benefits years later.
