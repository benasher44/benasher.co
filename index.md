---
layout: default
title: Blog
url: /
in-nav: true
nav-order: 0
---
{% for post in site.posts %}
  {% include post.html content=post.content excerpt=post.excerpt title=post.title url=post.url date=post.date updated=post.updated %}
{% endfor %}
