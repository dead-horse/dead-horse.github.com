---
layout : post
category : nodejs 
title : Node.js C++ addon编写实战（二）之对象转换 
summary : 记录开发Node.js C++ addon过程中遇到的一些问题，经验总结，此篇为Node.js对象与C++对象之间的转换。   
keywords : nodejs,C++ addon
author : dead_horse
---

这是一个三篇的系列文章，记录Node.js C++扩展开发中的一些经验与坑。   
[Node.js C++ addon编写实战（一）之node-gyp](/nodejs/2012/10/08/c_addon_in_nodejs_node_gyp.html)   
[Node.js C++ addon编写实战（二）之对象转换 ](/nodejs/2012/10/09/c_addon_in_nodejs_object.html)   
[Node.js C++ addon编写实战（三）之Buffer](/nodejs/2012/10/10/c_addon_in_nodejs_buffer.html)   

补上第四篇：[Node.js C++ addon编写实战(四)之兼容v0.11+与nan模块](/nodejs/2013/11/10/c_addon_in_nodejs_11.html)  

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
注意，v8并没有提供直接的从*Value*到*Array*的转换，但是我们发现，*Array*是继承自*Object*的，而其实*Array*对象并没有提供比*Object*更多的接口。联系到js中，会发现，js中的*Array*和*Object*操作也是一样的相似。因此尽管v8没有提供从*Value*到*Array*的转换，但是转换成*Object*就已经足够了,因为完全可以把Array当作一个Object来操作。   

而所有的v8中的Boolean/Number/Int32等对象都有方法转换成C++原生的bool/double/int等类型。当然，同样有反过来转换的接口。因此从javascript与C++跨语言的数据类型转换就完全不是问题了。   

### Object与Array   
基础类型相对来说比较简单，而Object和Array相对来说需要更多的接口方法来进行设置和内容的获取。   

{% highlight c++ %}
//设置Object
Handle<v8::Object> v8Obj = v8::Object::New();
v8Obj->Set(v8::String::NewSymbol("key"), v8::Integer::New(1));

//查询是否有这个key,并获取对应的value
if (v8Obj->Has(v8::String::New("key"))) {
  Handle<v8::Value> value = v8Obj->Get(v8::String::New("key"));
}

//获取所有的key
Handle<Array> keys = v8Obj->GetOwnPropertyNames();

//获取object内元素的个数
int len = keys->Length();

//删除object内的元素
v8Obj->Delete(v8::String::New("key"));
{% endhighlight %}

是不是觉得上面的代码十分眼熟？   

{% highlight javascript %}
var obj = {};
obj.key = 1;
if (obj.hasOwnProperty('key')) {
  var value = obj.key;
}
var keys = Object.keys(obj);
var len = keys.length;

delete obj.key;
{% endhighlight %}

可以看到，js的代码完整的映射到了C++代码之上。   

而Array也是一样的，先用一张图描述Array和Object的关系：   
![object_and_array](/images/v8_object_and_array.jpg)    

在V8中，Array的接口基本就只是多了一个*Length*方法，获取数组的长度，而其他的方法都是继承自Object，所以Array的操作和Object非常类似。   

{% highlight c++ %}
Handle<v8::Array> v8Arr = v8::Array::New(length);
int length = 10;
for (int i = 0; i != length; ++i) {
  v8Arr->Set(i, v8::Integer::New(i));
}

Handle<Value> item = v8Arr->Get(10);
{% endhighlight %}

至此，js中的数据结构对应到v8中的部分基本已经罗列完毕，js与c++的数据交换也完全不是问题了，此时用c++写Node.js扩展基本已经没有问题了。:)   