---
layout: post
category : nodejs
title: exec与spawn方法的区别与陷阱
keywords: nodejs,child_process
summary: nodejs child_process子模块中，exec与spawn方法的区别与陷阱
author: dead_horse
---
###起因
  前几天之前写的一段程序突然报了个诡异的异常"maxBuffer exceeded"，追进去发现是在一个上传的模块中解压缩的时候调用了child_process.exec方法，在解压某个上传文件的时候抛异常了。而解压其他的文件就没有问题。于是把这个文件找出来，单独写了个一模一样的exec，调个子进程解压缩一遍，发现也没有错误，问题是一旦放到之前那段程序里面就报错了。于是只能去查API了。


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
  
  这时突然发现了一个一直被我忽略了的参数options,用来设定子进程的环境和执行条件。   
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
    maxBuffer: 200*1024,  /*stdout和stderr的最大长度*/
    killSignal: 'SIGTERM',
    cwd: null,
    env: null
  }
  {% endhighlight %}  
  
###问题解决    
  在exec的options中有一个选项maxBuffer，看到这就清楚了，估计是超出了这个maxBuffer。果然,回到刚才单独写的解压程序里面，把maxBuffer设为一个较小的值，就出现这个错误了。exec的默认stdout最大大小为200K，刚才写的这个程序因为PWD跟之前的代码不同，因此stdout变小了，导致问题没有重现。把子进程中解压文件的命令改成静默模式，就可以暂时把这个问题解决了。当然，也可以将其改写成spawn来完成，就不会有maxBuffer的限制了。
    

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
  {% endhighlight %}


###使用注意
  可以看出，exec在使用的便捷性上要超过spawn，且执行速度上也相差无几。不过这种便携性是要付出一定代价的。在exec的options中，有一项是maxBuffer，如果执行的command输出超出了这个长度，不管是采用回调函数方式，还是emit data事件方式传递结果，都会抛出maxBuffer exceeded异常，并且杀死子进程。此时子进程可能已经执行完成（maxBuffer和需要长度相差不大，在收到最后一个数据包的时候才超出），也可能是只执行了一半。因此如果需要使用exec，就要慎重设置maxBuffer(和timeout)，或者对执行的命令采用静默方式(同时可以略微提升执行速度)。  
  ps:感觉nodejs可以提供一个方法，把exec的回调函数传递结果（maxBuffer限制）去掉，保留exec的参数传递方式，就方便我这种小白了..  
