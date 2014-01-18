---
layout : post
category : nodejs
title : Node.js 依赖管理与项目构建工具
summary : 谈谈开发过程中一些
keywords : nodejs,C++ addon,node-hsf
author : dead_horse
---
## 依赖管理

node 由于 npm 的存在，几乎每个项目都有一大堆的依赖模块，我们要如何维护这些依赖模块呢？

### 原始的解决方案：手动管理

在最初接触 node 的时候，我们通常通过 npm 安装好依赖模块，然后就把这些依赖模块和我们自己的代码推上了github，甚至还会修改这些依赖模块的代码。

我的第一个 node 项目 [nae 网站](https://github.com/dead-horse/cnae-management-system)，就属于这一类。不忍直视的把一部分依赖模块传上了 git（可能是因为我修改了这些模块的内容），同时其他的依赖也没有通过 `package.json`统一管理。


### 进阶方案：package.json

当然，在摸索了一段时间之后，大部分的同学都开始知道，原来 npm 是需要和 package.json 一起玩儿的！

于是，我们开始把项目的依赖写到package.json里面，例如[这个项目](https://github.com/dead-horse/socket.io-sample)。于是，我们可以很方便的只需要执行：

```
$ git clone git@github.com:dead-horse/socket.io-sample.git
$ cd socket.io-sample
$ npm install
```

然后，依赖就按照我们在 package.json 里面写的装好了。

同时稍微细心一点的同学可能会发现，现在我的这个[项目](https://github.com/dead-horse/socket.io-sample)里面 node_modules 文件夹不见了，因为我把它加到了 `.gitignore` 文件中去了。为什么要这样做？

1. 保持代码库的精简。
2. 每次更新依赖的变更会污染提交之间的diff。
3. 一些 `c++ addon` 在不同的环境和 node 版本下需要重新编译，而如果别人从代码库拉下来的代码已经有了你编译好的代码，npm 是不会重新安装它们的。

### 高级方案：使用项目构建工具

上面通过 package.json 管理依赖的这一套解决方案，在入门和学习的很长一段时间内可能都已经足够了。但是，世界没有这么单纯，当你真正开始使用 node 做一些实际的工作的时候，你会发现进阶方案已经不太够用了：

1. npm 太慢，默认 python 版本太低，各种原因导致我们安装依赖可能并不是简单的一句 `npm install` 就可以解决的。
2. 单元测试、覆盖率报告、压测报告，各种编译，越来越多的命令需要执行。

是时候引入项目构建工具来帮我们解决这些问题了。这次出现在我们视野中的是 `GNU make`。它被广泛应用在 c 和 c++ 的项目构建之中，而我们的是 node 项目，为什么选择它？

1. 几乎所有的服务器，肯定都需要有 c / c++ 的编译环境，所以 make 工具也会默认的出现在几乎所有的服务器上。
2. 可以直接调用执行 shell 命令。
3. 它具有依赖检查的功能，且语法简单。

[cnpmjs.org](https://github.com/cnpm/cnpmjs.org) 就是一个通过 make 来进行项目构建的 node 项目。我们稍微精简一下它的 Makefile 文件：

```
TESTS = $(shell ls -S `find test -type f -name "*.test.js" -print`)
REPORTER = tap
TIMEOUT = 30000
MOCHA_OPTS =

install:
        @npm install --registry=http://registry.cnpmjs.org --cache=${HOME}/.npm/.cache/cnpm --disturl=http://dist.u.qiniudn.com

test: install
        @NODE_ENV=test ./node_modules/mocha/bin/mocha \
                --reporter $(REPORTER) \
                --timeout $(TIMEOUT) \
                --require should \
                $(MOCHA_OPTS) \
                $(TESTS)

test-cov:
        @$(MAKE) test MOCHA_OPTS='--require blanket' REPORTER=travis-cov

test-cov-html:
        @rm -f coverage.html
        @$(MAKE) test MOCHA_OPTS='--require blanket' REPORTER=html-cov > coverage.html
        @ls -lh coverage.html

.PHONY: test
```

基于这个 `Makefile` 文件，我们可以：

* **make install**: 从 cnpmjs.org 快速安装依赖
* **make test**: 安装所有的依赖并通过 mocha 执行单元测试。
* **make test-cov** && **make test-cov-html**: 执行单元测试并通过 blanket 模块来跑项目的测试覆盖率，生成 html 格式的测试报告。

## 版本管理

在前面，我们已经进化到了通过项目构建工具来管理项目依赖了，但是还有一个问题我们还没有解决：**依赖模块的版本**。

在讲下面的东西之前，我们先来看看所有 npm 中模块版本遵循的规范：[semver 2.0](http://semver.org/)。

1. 所有的版本都是 `MAJOR.MINOR.PATCH` 形式。
2. package.json 中 可以指定依赖模块为特定版本或者特定的版本范围。
    * `1.2.3`, `=1.2.3`：指定版本为1.2。3
    * `>1.2.3`, `<1.2.3`：大于/小于 1.2.3
    * `>=1.2.3`, `<=1.2.3`：大于等于/小于等于 1.2.3
    * `1.2.3 - 2.3.4 `：大于1.2.3并且小于2.3.4
    * `~1.2.3`：合理的靠近1.2.3，等价于 `>=1.2.3-0 <1.3.0-0`，`1.3.0-beta`不满足这个判断条件
    * `~1.2`： 等价于 `>=1.2.0-0 <1.3.0-0`，所有以1.2开头的版本，同样等价于 `1.2.x`
    * `~1`：等价于 `>=1.0.0-0 <2.0.0-0`，所有以1开头的版本，等价于 `1.x`
    * `*`：任意版本

我们有了这些管理版本的限定方法，看看我们能够怎么来控制依赖的版本。

### 豪放派

```
"dependencies": {
  "connect": "2.x",
  "mysql": "2.x",
  "redis": "*",
  "debug": "*",
  "eventproxy": "*",
  "connect-redis": "*"
}
```

这一种风格，最大的好处是不太需要修改这些依赖模块的版本了。但是隐藏的风险却很大：

1. npm 有缓存机制，所以如果用 `*`，不能保证从 npm 安装到的是最新版本。
2. 你本地安装完依赖，开发并测试通过了，可能生产环境安装到的依赖的版本和开发时可能不一样，一旦因此引入了隐藏的 bug，将会非常难发现。

因此，线上项目不太建议通过此种方式来管理依赖的版本。

### 婉约派

```
"dependencies": {
  "connect": "~2.12.0",
  "mysql": "~2.0.0",
  "redis": "~0.10.0",
  "debug": "*",
  "eventproxy": "~0.2.6",
  "connect-redis": "~1.4.6"
}
```

采用这种风格时，你需要跟踪你的依赖的版本，来决定你是不是要升级到新的版本。
线上依赖的版本和本地依赖的版本的相差，也被限定到了最小的级别。当然还是有一定的风险。

### 保守派

```
"dependencies": {
  "connect": "2.12.0",
  "mysql": "2.0.1",
  "redis": "0.10.0",
  "debug": "*",
  "eventproxy": "0.2.6",
  "connect-redis": "1.4.6"
}
```

这种风格的好处在于，它严格的限定了版本，线上依赖和本地依赖的差异基本已经降到了最低。
当然坏处也很明显，你几乎要跟踪所有依赖的版本情况，来决定是不是要升级你的依赖。

## 实际应用

在我们 node 的实际应用中，我们选择了第三种也就是最保守的方案，这样可以让我们尽量不会引入那些莫名其妙的bug。
当然，我们是很难坚持手工去维护这些模块的版本的，经常在过了很长一段时间后，突然发现项目的依赖都已经很旧了，这些版本升级带来的 bug fix 我们都没有享受到。

我们需要一个工具来帮助我们维护项目的依赖：

### autod

[autod](https://github.com/dead-horse/autod)：一个自动分析项目所有的文件，获取所有的项目依赖和它们的版本的工具。

autod 同时可以根据我们传递的一些选项和参数，来直接更新 package.json 文件：

* **-w**: 获取依赖并更新写入 package.json 文件
* **-e public,view**: 不分析 public 和 view 中的文件
* **-k connect**: 保持 connect 模块在 package.json 中的版本不被 autod 改变
* **-d nan**: 无论有没有在项目中直接 require nan 这个模块，也会获取它的最新版本写入 package.dependencies 中
* **-r http://r.npm.taobao.net**: 指定从哪个库获取这些模块的版本，默认会从 r.cnpmjs.org 获取。可以通过这个参数来设置它从内部获取。

通过这个工具，我们可以很轻松的跟踪到所有依赖的最新版本，同时可以自动更新我们的 package.json 文件，新引入的模块也不需要手动去更新 package.json 文件了，一切都可以交给 autod 来完成。

![autod pic](http://ww1.sinaimg.cn/large/69c1d4acgw1ecnugf8cxdj20e10hc40b.jpg)

### 集成到 make

通常，我们会在 Makefile　中加入 autod 相关的配置项，来自动化完成这个过程：

```
# in Makefile
autod: install
        @./node_modules/.bin/autod -w -e public,view,docs,backup
        @$(MAKE) install

# in package.json

"devDependencies": {
  "autod": "~0.0.11"
}
```

这样，我们只需要执行 `make autod`，就会按照我们的配置，更新 package.json 文件，并重新安装这些模块了。

例如，我在代码里面需要引入 `async` 模块，这时候，只需要在代码里面：

```
var async = require('async');
```

然后在终端行执行：

```
$ make autod
```
就完成了 `async` 模块的安装，并将最新的 async 版本写入到了 package.json 文件中。

看看 [cnpmjs.org](https://github.com/cnpm/cnpmjs.org/blob/master/package.json#L23) 通过 autod 管理依赖版本的效果吧！
