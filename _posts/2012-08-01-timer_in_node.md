---
layout : post
category : nodejs 
title : 浅析nodejs中的setTimeout
summary : Node.js中的setTimeout是如何实现的，node对其进行了一些什么优化。
keywords : nodejs,timer
author : dead_horse
---

### 一个案例   

```
var http = require('http');

var get = function(options, timeout, cb) {
  var timer = null;
  var req = http.get(options, function(res) {
    res.on('data', function(data) {
    });
    res.on('end', function() {
      cb(null, 'end');
      timer && clearTimeout(timer);
    });
  });
  timer = setTimeout(function() {
    timer = null;
    cb(new Error('response time out'));
  }, timeout);
}

```   
  众所周知，node的http模块中的`get`和`request`方法都是没有超时选项的。在使用的时候很可能会自己通过timer来设置超时返回。上面的`get`方法， 会对每一个请求设置一个timeout，当超时的时候返回错误。之前在写一个网络相关的模块的时候就碰到了类似的问题。在写出类似上面版本的代码之后，脑海中肯定浮出一个疑问，每一次请求都设置一个定时器，会不会效率太低呢？node会不会对setTimeout进行一定的优化呢？如果改写成这个样子呢？   
  ```
var request = {};
var interval = setInterval(function() {
    var now = new Date().getTime();
    for(var key in request) {
      var req = request[key];
      if (now - req.startTime >= req.timeout) {
        delete request[key];
        req.cb(new Error('response time out'));
      }
    }
  }, 100);
var packetId = 0;
var _get = function(options, timeout, cb) {
  var timer = null;
  packetId++;
  var req = http.get(options, function(res) {
    res.on('data', function(data) {
    });
    res.on('end', function() {
      delete request[packetId];
      cb(null, 'end');
    });
    request[packetId] = {
      startTime: new Date().getTime(),
      timeout: timeout,
      cb: cb
    };
  });
}
  ```

 于是我分别对这两个方法进行了一下测试，发现两种方法的效率相差无几。果然，node对timeout进行了一定的优化，只能翻开node的源码一探究竟。   

### node中timer的实现   
 源码在此：[timer.js](https://github.com/joyent/node/blob/master/lib/timers.js).   
 在源码中，发现了node对于setTimeout的优化：
  1. 所有timer按照超时时间分组，所有超时时间相同的timer都存放到一个list里面，按时间顺序排列。   
  ```
  exports.active = function(item) {
  var msecs = item._idleTimeout;
  if (msecs >= 0) {

    var list = lists[msecs];
    if (!list || L.isEmpty(list)) { //list is empty, must init first.
      insert(item, msecs);
    } else {                        //list is not empty, just insert back
      item._idleStart = Date.now();
      L.append(list, item);
    }
  }
  ```
  2. 初始化的时候，给一个list设置一个定时器。   
  ```
  function insert(item, msecs) {
    item._idleStart = Date.now();
    item._idleTimeout = msecs;

    if (msecs < 0) return;

    var list;

    if (lists[msecs]) {
      list = lists[msecs];
    } else {
      list = new Timer();   
      list.start(msecs, 0); // init a timer for each list

      L.init(list);

      lists[msecs] = list;

      list.ontimeout = function() {
        // handle timeout
      }

    L.append(list, item);
    assert(!L.isEmpty(list)); // list is not empty
  }
  ```
  3. 当定时器到时，从头到尾遍历list，把所有到时的timer都触发，然后从list中删除，遇到未到时的timer，重新设置一个定时器.
  ```
  list.ontimeout = function() {
    var now = Date.now();
    var first;
    while (first = L.peek(list)) {        //walk the list
      var diff = now - first._idleStart;
      if (diff + 1 < msecs) {             //if still not ok, active a new timer
        list.start(msecs - diff, 0);
        debug(msecs + ' list wait because diff is ' + diff);
        return;
      } else {                            //if timeout, remove item and call _onTimeout
        L.remove(first);
        assert(first !== L.peek(list));
        //...
        first._onTimeout();
        //...
    }
    assert(L.isEmpty(list));
    list.close();
    delete lists[msecs];
  };
   ```
  所有相同timeout的timer的背后，同一时间内只会有一个定时器，回到之前的`get`方法，尽管设置了很多个timer，但是其背后都只是存放到一个链表中，node会和`_get`中的方式类似去遍历链表。因此两者的性能相差不多。     