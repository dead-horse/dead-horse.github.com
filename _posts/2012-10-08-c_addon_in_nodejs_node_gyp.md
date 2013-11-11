---
layout : post
category : nodejs 
title : Node.js C++ addon编写实战（一）之node-gyp 
summary : 记录开发Node.js C++ addon过程中遇到的一些问题，经验总结，此篇为node-gyp的介绍。   
keywords : nodejs,C++ addon,node-hsf
author : dead_horse
---

这是一个三篇的系列文章，记录Node.js C++扩展开发中的一些经验与坑。   
[Node.js C++ addon编写实战（一）之node-gyp](/nodejs/2012/10/08/c_addon_in_nodejs_node_gyp.html)   
[Node.js C++ addon编写实战（二）之对象转换 ](/nodejs/2012/10/09/c_addon_in_nodejs_object.html)   
[Node.js C++ addon编写实战（三）之Buffer](/nodejs/2012/10/10/c_addon_in_nodejs_buffer.html)   

补上第四篇：[Node.js C++ addon编写实战(四)之兼容v0.11+与nan模块](/nodejs/2013/11/10/c_addon_in_nodejs_11.html)  

### 从node-waf到node-gyp   
node进入0.8版本之后，开始替换之前编译C++模块的编译工具，从node-waf向[node-gyp](https://github.com/TooTallNate/node-gyp)转换，暂时是两者都支持，之后会不在支持node-waf编译。因此要写node的C++扩展，首先需要了解如何编写node-gyp的配置文件。  
node-gyp的配置文件名字为*binding.gyp*,它是一个纯JSON对象，相对于node-waf的配置文件来说，写惯了javascript的同学会更加熟悉。   

### Hello node-gyp
先来看一个最简单的使用示例。  
C模块部分提供了一个hello方法，返回一个字符串*world*:   

{% highlight c %}
#include <node.h>
#include <v8.h>

using namespace v8;

Handle<Value> Method(const Arguments& args) {
  HandleScope scope;
  return scope.Close(String::New("world"));
}

void init(Handle<Object> target) {
  NODE_SET_METHOD(target, "hello", Method);
}

NODE_MODULE(binding, init);
{% endhighlight %}

binding.gyp指定C部分源文件路径和最终生成模块的名称，此例中将会生成一个可以被node调用的*binding.node*文件。   

{% highlight javascript %}
{
  'targets': [
    {
      'target_name': 'binding',
      'sources': [ 'binding.cc' ]
    }
  ]
}
{% endhighlight %}

js调用代码：   

{% highlight javascript %}
var assert = require('assert');
var binding = require('./build/Release/binding');
assert.equal('world', binding.hello());
console.log('binding.hello() =', binding.hello());
{% endhighlight %}

### 一个复杂一点的例子   
在编写node-hsf的时候，由于涉及到第三方库的引入，以及对mac和linux的兼容，因此编译脚本会相对更加复杂。   

{% highlight javascript %}
{
  'targets': [
    {
      'target_name': 'hsfProtocol',
      'sources': ['hsf_protocol.cc'],
      'cflags': ['-fexceptions', '-Wall', '-D_FILE_OFFSET_BITS=64','-D_LARGEFILE_SOURCE', '-O2'],    //编译选项
      'cflags_cc': ['-fexceptions', '-Wall', '-D_FILE_OFFSET_BITS=64','-D_LARGEFILE_SOURCE', '-O2'],
      'cflags!': ['-fno-exceptions'],    //关闭的编译选项
      'cflags!_cc': ['-fno-exceptions'],
      'conditions': [
        ['OS=="mac"', {    //满足此条件后开启
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
          }
        }]
        ],
      'include_dirs': [    //引用第三方库的头文件路径
                       '../hsf_protocol/utils',
                       '../hsf_protocol/objects',
                       '../hsf_protocol/hessian',
                       '../hsf_protocol/hsf']
    }
  ]
}
{% endhighlight %}

注意事项：    
1. 如果遇到了*exception handling disabled, use -fexceptions to enable*错误，需要添加编译选项*-fexceptions*。如果还是不行，则可能是因为该版本的node-gyp默认启用了*-fno-exceptions*选项，因此通过*cflags!*和*cflags!_cc*中指定关闭掉这个默认开启的选项。  
2. *conditions*内可以根据一些条件来添加选项，例如根据操作系统来添加一些编译条件。       
3. 依赖的第三方动态链接库可能无法引入，出现这种情况可以把静态库和node-gyp生成的中间文件一起编译成最终的模块。   

{% highlight bash %}
#!/bin/bash

HSFPROTOCOL_HOME="`pwd`/hsf_protocol"
SYSTEM=`uname -s`
EXTRA_FLAG="";

if [ $SYSTEM = "Darwin" ] ; then #判断是否是mac操作系统
  # for mac    
  EXTRA_FLAG="-flat_namespace -undefined suppress"
  echo 'building for mac'
fi
node-gyp configure build
gcc -fcc1-exceptions -fexceptions -O2 -o hsfProtocol.node ./build/Release/obj.target/hsfProtocol/hsf_protocol.o \
  $HSFPROTOCOL_HOME/libhsf.a -shared -fPic $EXTRA_FLAG
{% endhighlight %}

可以看到在上面脚本中，把node-gyp生成的中间文件*hsf_protocol.o*与静态库*libhsf.a*编译成最终的*hsfProtocol.node*。为了进行跨平台的编译，如果是mac操作系统，则需要多添加*-flat_namespace -undefined suppress*这几个编译选项。   

关于node-gyp的一些其他参考资料和范例和更复杂的用法，请查阅[node-gyp in github](https://github.com/TooTallNate/node-gyp)。   
