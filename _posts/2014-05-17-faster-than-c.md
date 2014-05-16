---
layout : post
category : nodejs
title : faster than c: 优化你的 js 代码
summary : 记录一次优化 js 协议序列化库的过程
keywords : nodejs,performance,buffer
author : dead_horse
---

最近在重构一个 RPC 框架，主要是通过使用纯 js 实现一个基于 buffer 的网络协议的序列化和反序列化包，
替换掉之前的 c++ 扩展版本，目的是解决现在遇到的一些跨平台问题，同时提升可维护性。然而在千辛万苦
实现完纯 js 版本的协议之后却发现，性能只有 c++ 版本的 1/3 ~ 1/2，完全无法替代 c++ 版本。为了
之前的功夫不白费，于是开始走上了慢慢优化之路。

### profiler 没有作用
