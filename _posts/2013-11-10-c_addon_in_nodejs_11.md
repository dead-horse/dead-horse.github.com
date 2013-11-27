---
layout : post
category : nodejs 
title : Node.js C++ addon编写实战（四）之兼容v0.11+与nan模块
summary : 记录开发Node.js C++ addon过程中遇到的一些问题，经验总结，此篇为node-gyp的介绍。   
keywords : nodejs,C++ addon,node-hsf
author : dead_horse
---

前面三篇介绍文章：  
[Node.js C++ addon编写实战（一）之node-gyp](/nodejs/2012/10/08/c_addon_in_nodejs_node_gyp.html)   
[Node.js C++ addon编写实战（二）之对象转换 ](/nodejs/2012/10/09/c_addon_in_nodejs_object.html)   
[Node.js C++ addon编写实战（三）之Buffer](/nodejs/2012/10/10/c_addon_in_nodejs_buffer.html)   

### node v0.11+ 的变化  
Node.js 日趋成熟，即将要发布 v1.0 版本，但是在成长过程中，不得不有一些 API 的变化。在从 v0.10 向 v0.11/v0.12 升级的过程中，就导致了几处 C++ addon 编写上的变化。  

#### Buffer  
在[API changes between v0.10 and v0.12](https://github.com/joyent/node/wiki/API-changes-between-v0.10-and-v0.12)中我们发现： 
  > All `node::Buffer::New()` variants now return `Local<Object>` instead of `Buffer*`.  

我们不再需要通过 `Buffer::New(str, 100)->handle_` 来获取能传递给 js 的 Buffer 对象了，New 出来的就已经是 v8 对象了。   

#### V8 API  
同时，在 node v0.11.4+ 的版本，v8 进行了一次大的升级，API 有一些大的调整，通过一个小例子来展示这一套新的 API 在使用上的变化：   


```c++
//in node 0.10
Handle<Value> Add(const Arguments& args) {
  HandleScope scope;

  if (args.Length() < 2) {
    ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
    return scope.Close(Undefined());
  }

  if (!args[0]->IsNumber() || !args[1]->IsNumber()) {
    ThrowException(Exception::TypeError(String::New("Wrong arguments")));
    return scope.Close(Undefined());
  }

  Local<Number> num = Number::New(args[0]->NumberValue() +
      args[1]->NumberValue());
  return scope.Close(num);
}

//in node 0.11.4+  
template<class T> void Add(const v8::FunctionCallbackInfo<T>& info) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (info.Length() < 2) {
    ThrowException(Exception::TypeError(
        String::New("Wrong number of arguments")));
    info.GetReturnValue().SetUndefined();
    return;
  }

  if (!info[0]->IsNumber() || !info[1]->IsNumber()) {
    ThrowException(Exception::TypeError(String::New("Wrong arguments")));
    info.GetReturnValue().SetUndefined();
    return;
  }

  Local<Number> num = Number::New(info[0]->NumberValue() +
      info[1]->NumberValue());
  info.GetReturnValue().Set(num);
}
```

可以看到，变化主要在函数声明、 `HandleScope` 初始化以及如何返回数据这三点上。

#### 其他 Bug  
在 linux (Red Hat Enterprise Linux Server release 5.7 (Tikanga)) 和 node v0.11.8 下编译我的一个 C++ addon 的时候，出现了一个诡异的Bug，调用: `v8::Value::ToInteger()` 这个方法的时候会在链接的时候报错 `undefined symbol`, 最终没有找到原因，通过 `V8::Value::IntegerValue()` 替换了之前的实现，一切恢复正常。   


### node C++ addon 辅助编写模块 `nan`  
上面废话了这么多来谈谈 node 升级导致的 C++ addon 兼容性问题，是不是很想写一个辅助模块来把这些变化全部封装起来？ 别急，早就有大神做了这件事情：[nan](https://github.com/rvagg/nan) 是 [rvagg](https://github.com/rvagg)(iconv 和 levelup 的作者) 发起维护的一个辅助模块，最近[TooTallNate](https://github.com/TooTallNate)(node-gyp作者，node开发组成员)也加入开始维护这个模块。  
  
  >A header file filled with macro and utility goodness for making add-on development for Node.js easier across versions 0.8, 0.10 and 0.11, and eventually 0.12.

通过 `nan` 来简化上面的示例代码：  

```c++
//with nan
#include "nan.h"

NAN_METHOD(Add) {
  NanScope();

  if (args.Length() < 2) {
    ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
    return scope.Close(Undefined());
  }

  if (!args[0]->IsNumber() || !args[1]->IsNumber()) {
    ThrowException(Exception::TypeError(String::New("Wrong arguments")));
    return scope.Close(Undefined());
  }

  Local<Number> num = Number::New(args[0]->NumberValue() +
      args[1]->NumberValue());
  NanReturnValue(num);
}
```

通过 `nan`，再也不用管兼容性问题，也不需要些那么一长串的函数声明了。当然，它不单单是解决了这个问题，上面提到的 `Buffer API` 的变更， `nan` 也有封装。更多的接口以及详细的使用方式，可以查阅它的[文档](https://github.com/rvagg/nan)。

