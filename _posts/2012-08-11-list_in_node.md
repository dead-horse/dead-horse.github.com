---
layout : post
category : nodejs 
title : 如何在node / javascript中实现链表？
summary : Node源码中一个非常精简的链表实现。  
keywords : nodejs,List
author : dead_horse
---

  javascript的Array和Object已经足够使用了，但是并不代表List完全没有用武之地。如何用js这种动态语言完成链表？google一下`javascript 链表`，出现的大都是非常常规的链表实现，就像[这种](http://rockis.iteye.com/blog/23005)。用js能不能把链表实现的更加优雅呢？ 这个还真有~在Node.js的源码中，就实现了一个非常精简优雅的链表。   

{% highlight javascript %}
//初始化一个链表，可以将任何Object都当作链表来操作
function init(list) {
  list._idleNext = list;
  list._idlePrev = list;
}

// show the most idle item， 获取前一个节点
function peek(list) {
  if (list._idlePrev == list) return null;
  return list._idlePrev;
}

// remove the most idle item from the list，移除并返回前一个节点
function shift(list) {
  var first = list._idlePrev;
  remove(first);
  return first;
}

// remove a item from its list，移除节点
function remove(item) {
  if (item._idleNext) {
    item._idleNext._idlePrev = item._idlePrev;
  }
  if (item._idlePrev) {
    item._idlePrev._idleNext = item._idleNext;
  }
  item._idleNext = null;
  item._idlePrev = null;
}

// remove a item from its list and place at the end.将节点插入到指定节点之后
function append(list, item) {
  remove(item);
  item._idleNext = list._idleNext;
  list._idleNext._idlePrev = item;
  item._idlePrev = list;
  list._idleNext = item;
}

function isEmpty(list) {
  return list._idleNext === list;
}
{% endhighlight %}

  短短几十行代码，就完整实现了一个双向链表，尽管只实现了上述的几个方法，但是已经足够使用，并且也非常容易扩展，将javascript语言的灵活性展现的淋漓尽致。[源码在此](https://github.com/joyent/node/blob/master/lib/_linklist.js)。而`node`的`setTimeout`也是基于这个版本的链表进行了优化，[详见](http://deadhorse.me/nodejs/2012/08/01/timer_in_node.html)。在你的`node`程序中可以通过`require('_linklist')`来使用，我把它提取出来并添加了其他几个方法，封装成了一个[模块](https://github.com/dead-horse/js-linklist), 可以通过npm安装：npm install linklist.   