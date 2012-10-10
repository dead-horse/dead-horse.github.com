---
layout : post
category : nodejs 
title : Node.js C++ addon编写实战（三）之Buffer
summary : 记录开发Node.js C++ addon过程中遇到的一些问题，经验总结，此篇为Node.js中的buffer与C++之间的转换。   
keywords : nodejs,C++ addon,buffer
author : dead_horse
---

这是一个三篇的系列文章，记录Node.js C++扩展开发中的一些经验与坑。   
[Node.js C++ addon编写实战（一）之node-gyp](/nodejs/2012/10/08/c_addon_in_nodejs_node_gyp.html)   
[Node.js C++ addon编写实战（二）之对象转换 ](/nodejs/2012/10/09/c_addon_in_nodejs_object.html)   
[Node.js C++ addon编写实战（三）之Buffer](/nodejs/2012/10/10/c_addon_in_nodejs_buffer.html)   

上一篇文章介绍到了javascript到v8的数据映射关系和转换方法，然而Node.js除了javascript的数据类型之外，还自己实现了一个数据类型：Buffer。关于Node.js中的Buffer，可以先看一下[这篇文章]（http://cnodejs.org/topic/4f16442ccae1f4aa27001067），详细解析了node中buffer内存策略。   

因为Buffer是独立于v8之外的，且没有相关的C++部分代码的文档，不过相关的接口还是可以通过阅读[源代码](https://github.com/joyent/node/blob/master/src/node_buffer.h)来了解。   
接下来就开始介绍一下Node.js C++扩展实际开发过程中涉及到Buffer部分的一些处理和注意事项。   

### Buffer的传递   
先看一下Buffer是如何从node传递到c++中的。 

{% highlight c++ %}
Handle<Value> length(const Arguments &args) {
  HandleScope scope;
  Local<Value> arg = args[0];
  if(!Buffer::HasInstance(arg)) { //判断是否是Buffer对象
    ThrowException(v8::Exception::TypeError(v8::String::New("Bad argument!")));  //抛出js异常 
  }
  size_t size = Buffer::Length(arg->ToObject());  //获取Buffer长度
  char *buf = Buffer::Data(arg->ToObject());      //获取Buffer内容
  return scope.Close(v8::Integer::New(size));
}
{% endhighlight %}

可以看到，node中的Buffer可以转换成c++ 中的char*，现在再来看看如何将c++中的Buffer传递给Node.js。   
方法一: node_buffer.h中可以看到有一个C++ API： *static v8::Handle<v8::Object> New(v8::Handle<v8::String> string);*，因此可以尝试用此API进行转换并传递到node中。   

{% highlight c++ %}
Handle<Value> transfer(const Arguments& args) {
  HandleScope scope;
  char a[6] = {13, 1, 1, 0, 0, -123};
  //return scope.Close(Buffer::New(String::New(a))); //会被第四个字符0截断
  return scope.Close(Buffer::New(String::New(a, 6))); //无法解析成utf-8或者iscii，转换错误
}
{% endhighlight %}

可以看到上面代码中的注释，必须要指定传递Buffer的长度，不然有可能会被截断。同时这种方法只适用于编码方式可以被String接受的Buffer传递，例如utf8，iscii。而一些没有编码的Buffer，则可能在生成String的时候就导致了某些字节的错乱，转换会不完全。   
因此，通过这个C++ API进行Buffer的传递是有条件的，必须要是能编码成String的Buffer才能够使用这个API。  

方法二：曲线救国，将C++中的char *转换成一个short类型的数组，传递到node中，然后再调用node中的*new Buffer(array)*来生成Buffer。   

{% highlight c++ %}
Handle<Value> transferByArray(const Arguments& args) {
  HandleScope scope;
  char a[100] = {-2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111
                };
  Handle<Array> bufArray = v8::Array::New(100);
  for(unsigned i=0; i!=100; ++i) {
    bufArray->Set(i, v8::Integer::New((short)a[i]));
  }
  return scope.Close(bufArray);
}
{% endhighlight %}

{% highlight javascript %}
var buf = new Buffer(transferByArray());  //把C++中生成的array转化成为Buffer   
{% endhighlight %}

这个方法虽然可以传递Buffer，但是效率十分底。   

方法三： node_buffer.h中实现的Buffer对象有一个*_handle*属性，它是一个v8对象，指向这个Buffer实例，因此可以通过它将Buffer对象传递到node中。  

{% highlight c++ %}
Handle<Value> transferBySlowBuffer(const Arguments& args) {
  HandleScope scope;
  char a[100] = {-2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111,
                -2, 0, 1, 2, 0, 0, 0, 0, -127, 32, 0, 0, 0, -52, 77, 116, 0, 42, 99, 111
                };
  Buffer *buf = Buffer::New(a, 100);
  return scope.Close(buf->handle_);
}
{% endhighlight %}

从上面代码的函数名中可以看出，通过*buf->handle_*传递进node的Buffer是SlowBuffer类型的，关于SlowBuffer与Buffer，在篇头给出的文章中有详细的描述。   
在写原生的node代码的时候，我们是很少接触到SlowBuffer对象的，一般都是使用Buffer，而SlowBuffer其实与Buffer有细微的区别，需要特别注意。   

{% highlight javascript %}
var SlowBuffer = require('buffer').SlowBuffer;

var slowBuf = new SlowBuffer(10);
slowBuf instanceof Buffer; //true in v0.8+, false in v0.6+
Buffer.isBuffer(slowBuf);  //true in both v0.8+ and v0.6+
{% endhighlight %}

因此千万注意不要使用 instanceof Buffer来判断是否是Buffer类型，否则可能会被坑。   

Buffer在node与c++之间的传递和转换到此结束。加上前面的两篇文章，如何编写node的C++扩展应该已经没有太多疑问了。:)   