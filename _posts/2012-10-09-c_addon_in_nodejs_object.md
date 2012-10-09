---
layout : post
category : nodejs 
title : Node.js C++ addon编写实战（二）之对象转换 
summary : 记录开发Node.js C++ addon过程中遇到的一些问题，经验总结，此篇为Node.js对象与C++对象之间的转换。   
keywords : nodejs,C++ addon
author : dead_horse
---

正式进入编写Node.js C++模块中编码部分的介绍了。在此之前先罗列一些这方面的资料供参考入门。   

 * v8数据结构的手册： [V8 Data Structures](http://izs.me/v8-docs/annotated.html)   
 * node C++模块入门: [node-cpp-module g](https://github.com/kkaefer/node-cpp-modules)   
 * 从C++的角度了解node: [Javascript里有个C](http://cnodejs.org/topic/4f16442ccae1f4aa270010c5)   

这些资料可以引导我们写出一个完整的Node.js的C++扩展了。但是也许下面的内容能够让你写的过程中更轻松。   

### 函数参数      
C++模块中可以被node调用的方法，都是如下形式的：   

{% highlight c++ %}
Handle<Value> Method(const Arguments& args) {
  //code here
}
{% endhighlight %}

传入的参数*args*对象有两个常用的操作：   

{% highlight c++ %}
Local<Value> arg = args[0]; //[]操作符，获取到一个Local<Value>的对象
int length = args.Length();  //Length方法，获取参数长度
{% endhighlight %}

在上述代码中出现了*Local<Value>*,v8中的继承关系如下：   
![v8 handle](/images/v8_handle.jpg)   
*Handle<Class T>*是v8维护的一个对象引用，v8会负责对象的回收，可以看作是v8中的智能指针。*Local<Class T>*是继承自它的一个轻量级的对象引用，[more](http://izs.me/v8-docs/classv8_1_1Local.html#_details)。   

### 数据类型转换

v8中整体的数据结构关系图如下：   
![v8 data structure](/images/v8_data_structure.jpg)   

可以看到，所有的*String, Number, Boolean, Object, Array*等对象都是从*Value*继承而来。因此从*Arguments*中获取的*Local<Value>*对象可以轻松的判断其js中的具体类型，并进行转换。   

#### 类型判断：   

{% highlight c++ %}
Local<Value> arg = args[0];
bool isArray = arg->IsArray();
bool isBoolean = arg->IsBoolean();
bool isNumber = arg->IsNumber();
bool isInt32 = arg->IsInt32();
// more
{% endhighlight %}

v8提供了一系列的接口用来做类型判断，可以在其[文档](http://izs.me/v8-docs/classv8_1_1Value.html)内找到所有的判断接口。   

#### 类型转换：   
 在经过类型判断之后，就可以根据结果进行类型的转换了：   

{% highlight c++ %}
Local<Value> arg = args[0];
Local<Object> = arg->ToObject();
Local<Boolean> = arg->ToBoolean();
Local<Number> = arg->ToNumber();
Local<Int32> = arg->ToInt32 ();
// more
{% endhighlight %}

同样的，v8提供了一系列的接口用来做类型转换，可以在其[文档](http://izs.me/v8-docs/classv8_1_1Value.html)内找到所有的转换接口。   
注意，v8并没有提供直接的从*Value*到*Array*的转换，但是我们发现，*Array*是继承自*Object*的，而其实*Array*对象并没有提供比*Object*更多的接口。联系到js中，会发现，js中的*Array*和*Object*操作也是一样的相似。因此尽管v8没有提供从*Value*到*Array*的转换，但是转换成*Object*就已经足够了。   


### 未完待续    