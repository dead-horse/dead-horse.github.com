---
layout : post
category : nodejs
title : Node.js 依赖管理与项目构建工具
summary : 谈谈开发过程中一些
keywords : nodejs,C++ addon,node-hsf
author : dead_horse
---

### 原始的解决方案：手动管理

在最初接触 node 的时候，我们通常通过 npm 安装好依赖模块，然后就把这些依赖模块和我们自己的代码推上了github，甚至还会修改这些依赖模块的代码。

我的第一个 node 项目 [nae 网站](https://github.com/dead-horse/cnae-management-system)，就属于这一类。不忍直视的把一部分依赖模块传上了 git（肯定是因为我修改了这些模块的内容），同时其他的依赖也没有通过 `package.json`统一管理。


### 进阶方案：package.json

当然，在摸索了一段时间之后，大部分的同学都开始知道，原来 npm 是需要和 package.json 一起玩儿的！

于是，我们开始把项目的依赖写到package.json里面，例如[这样](https://github.com/dead-horse/socket.io-sample)。于是，我们可以很方便的只需要执行：

```
$ git clone git@github.com:dead-horse/socket.io-sample.git
$ cd socket.io-sample
$ npm install
```

然后，依赖就按照我们在 package.json 里面装好了。

稍微细心一点的同学可能会发现，现在我的这个[项目](https://github.com/dead-horse/socket.io-sample)里面 node_modules 文件夹不见了，因为我把它加到了 `.gitignore` 文件中去了。为什么要这样做？

1. 保持代码库的精简。
2. 每次更新依赖的变更会污染提交之间的diff。
3. 一些 `c++ addon` 在不同的环境和 node 版本下需要重新编译，而如果别人从代码库拉下来的代码已经有了你编译好的代码，npm 是不会重新安装它们的。

### 高级方案：使用项目构建工具

上面通过 package.json 管理依赖的这一套解决方案，在入门和学习的很长一段时间内可能都已经足够了。但是，世界没有这么单纯，当你真正开始使用 node 做一些实际的工作的时候，你会发现进阶方案已经不太够用了：

1. npm 太慢，默认 python 版本太低，各种原因导致我们安装依赖可能并不是简单的一句 `npm install` 就可以解决的。
2. 单元测试、覆盖率报告、压测报告，各种编译，越来越多的命令需要执行。

是时候引入项目构建工具来帮我们解决这些问题了。这次出现在我们视野中的是 `make`。它被广泛应用在 c 和 c++ 的项目构建之中，而我们的是 node 项目，为什么选择它？

1. 几乎所有的服务器，肯定都需要有 c / c++ 的编译环境，所以 make 工具也会默认的出现在几乎所有的服务器上。
2. 可以直接调用执行 shell 命令
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






