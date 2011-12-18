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
  {% highlight javascript %}
  var ls = cp.spawn('ls'/*command*/, ['-lh', '/usr']/*args*/, {}/*env*/);
  ls.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });
  
  ls.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });
  
  ls.on('exit', function (code) {
    console.log('child process exited with code ' + code);
  });
  {% endhighlight %}  
  