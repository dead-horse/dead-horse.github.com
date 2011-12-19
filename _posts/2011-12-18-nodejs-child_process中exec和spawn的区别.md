---
layout: post
title: exec与spawn方法的区别与陷阱
keywords: nodejs,child_process
summary: nodejs child_process子模块中，exec与spawn方法的区别与陷阱
author: dead_horse
---

###exec与spawn
  在nodejs的child_process模块中，有两个类似的方法spawn和exec，都是通过生成一个子进程，去执行指定的命令，不过他们的用法稍有不同,在命令的指定上，exec相对灵活，等于一个shell的命令行，如'ps -ef | grep node'此类的管道操作也能一次性实现。  
  nodejs文档用法e.x:
  {% highlight javascript %}
  var cp = require('child_process');
  //spawn
  var ls = cp.spawn('ls'/*command*/, ['-lh', '/usr']/*args*/, {}/*options, [optional]*/);
  ls.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  ls.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  ls.on('exit', function (code) {
    console.log('child process exited with code ' + code);
  });

  //exec
  cp.exec('ls -lh /usr'/*command*/,{}/*options, [optiona]l*/, function(err, stdout, stderr){
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
  })
  {% endhighlight %}  
  
  这两个函数都有一个可选的参数options,用来设定子进程的环境和执行条件。  
  spawn的options默认为:  
  {% highlight javascript %}
  { 
    cwd: undefined,
    env: process.env,
    setsid: false
  }
  {% endhighlight %}  
  exec的options默认为：
  {% highlight javascript %}
  { 
    encoding: 'utf8',
    timeout: 0, /*子进程最长执行时间 */
    maxBuffer: 200*1024,  /*stdout和stderr的最大长度，如果超出将会抛出maxBuffer exceeded错误*/
    killSignal: 'SIGTERM',
    cwd: null,
    env: null
  }
  {% endhighlight %}  


###本质
  虽然在上面的文档用法中，spwan和exec的最终回调方式有区别，但是在node的实现中，其实两者的实现方式是一致的，exec也可以像spawn一样使用，只不过exec在触发stderr和stdout的data事件的时候，会把数据写到字符串中，到执行结束或者错误退出的时候通过回调函数传递出来，实现了exec这种便捷用法。
  {% highlight javascript %}
  var cp = require('child_process');
  //exec可以像spawn一样使用
  var ls = cp.exec('ls -lh /usr', {}/*options, [optional]*/);

  ls.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  ls.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  ls.on('exit', function (code) {
    console.log('child process exited with code ' + code);
  });
  {% endhightlight %}


###使用注意
  可以看出，exec在使用的便捷性上要超过spawn，且执行速度上也相差无几。不过这种便携性是要付出一定代价的。在exec的options中，有一项是maxBuffer，如果执行的command输出超出了这个长度，不管是采用回调函数方式，还是emit data事件方式传递结果，都会抛出maxBuffer exceeded异常，并且杀死子进程。此时子进程可能已经执行完成（maxBuffer和需要长度相差不大，在收到最后一个数据包的时候才超出），也可能是只执行了一半。因此如果需要使用exec，就要慎重设置maxBuffer(和timeout)，或者对执行的命令采用静默方式(同时可以略微提升执行速度)。  
  ps:感觉nodejs可以提供一个方法，把exec的回调函数传递结果（maxBuffer限制）去掉，保留exec的参数传递方式，就方便我这种小白了..  

  --EOF--
