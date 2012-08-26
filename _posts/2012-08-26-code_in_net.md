---
layout : post
category : nodejs 
title : Node.js net 模块阅读笔记
summary : Node.js net模块中一些优美的代码片段  
keywords : nodejs,net
author : dead_horse
---

 1. 引用`node`源码中的C模块   

{% highlight javascript %}   
// constructor for lazy loading
function createPipe() {
  var Pipe = process.binding('pipe_wrap').Pipe;
  return new Pipe();
}
{% endhighlight %}   

 2. 通过与或操作设置读取标记位   

{% highlight javascript %}   

/* Bit flags for socket._flags */
var FLAG_GOT_EOF = 1 << 0;
var FLAG_SHUTDOWN = 1 << 1;
var FLAG_DESTROY_SOON = 1 << 2;
var FLAG_SHUTDOWN_QUEUED = 1 << 3;

var flags = 0;
flags & FLAG_GOT_EOF; //检查是否设置了这个标识
flags | FLAG_GOT_EOF; //设置标志位

{% endhighlight %}   


 3. 字符串与整数的转换   

{% highlight javascript %}   
var secs = ~~(msecs / 1000);
{% endhighlight %}   

 4. 转换对象为Boolean  

{% highlight javascript %}   
var bool = !!input;
{% endhighlight %}   

 5. `process.nextTick`的使用  
有些情况下，可能希望在执行完当前事件循环之后再执行一些操作，通过`process.nextTick`将操作放到下一个事件循环去做,这样这些操作将不会影响当前事件循环的其他操作。  

{% highlight javascript %}   
//in socket.onread, when meet `EOF` 
// We call destroy() before end(). 'close' not emitted until nextTick so
// the 'end' event will come first as required.
if (!self.writable) self._destroy();

if (!self.allowHalfOpen) self.end();
if (self._events && self._events['end']) self.emit('end');

//in self_destroy
process.nextTick(function() {
  self.emit('close', exception ? true : false);
});
{% endhighlight %}   
通过process.nextTick()，可以保证在调用`_destroy`的时候不会先触发`close`事件。   

 6. 格式化输入参数，重新调用自身   

{% highlight javascript %}   
Socket.prototype.connect = function(options, cb) {
  if (typeof options !== 'object') {
    var args = normalizeConnectArgs(arguments);
    return Socket.prototype.connect.apply(this, args);
  }
  // do something
}
{% endhighlight %}   