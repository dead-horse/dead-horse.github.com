---
layout: post
title: exec与spawn方法的区别与陷阱
keywords: nodejs,child_process
summary: nodejs child_process子模块中，exec与spawn方法的区别与陷阱
author: dead_horse
---

###exec与spawn
  在nodejs的child_process模块中，有两个类似的方法spawn和exec，都是通过生成一个子进程，去执行指定的命令，不过他们的参数不同，回调机制也有些区别。  
  e.x:
  {% highlight java %}
    var a=1;
    var b=2;
    function a();
  {% endhighlight %}  
  