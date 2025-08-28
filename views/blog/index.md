---
layout: main
---

This is my blog and notes. It's mostly focused on literary theory, and trying to decipher what these guys are on about. 

<ul>
{%- for post in collections.post -%}
  <li><a href="{{post.url}}"=>{{ post.data.title }}</a></li>
{%- endfor -%}
</ul>


