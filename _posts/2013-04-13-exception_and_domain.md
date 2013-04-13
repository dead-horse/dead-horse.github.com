---
layout : post
category : nodejs 
title : node中异步异常的处理与domain  
summary : 由浅入深的介绍了node是如何对异步异常进行处理，以及domain的原理和局限性。   
keywords : nodejs,exception,domain
author : dead_horse
---

### 异步异常处理  

#### 异步异常的特点  
由于node的回调异步特性，无法通过`try catch`来捕捉所有的异常：   

```js
try {
  process.nextTick(function () {
  	foo.bar();
  });
} catch (err) {
  //can not catch it
}
```

而对于web服务而言，其实是非常希望这样的：   

```js
//express风格的路由
app.get('/index', function (req, res) {
  try {
    //业务逻辑
  } catch (err) {
    logger.error(err);
    res.statusCode = 500;
    return res.json({success: false, message: '服务器异常'});
  }
});
```

如果`try catch`能够捕获所有的异常，这样我们可以在代码出现一些非预期的错误时，能够记录下错误的同时，友好的给调用者返回一个500错误。可惜，`try catch`无法捕获异步中的异常。所以我们能做的只能是：  

```js
app.get('/index', function (req, res) {
  // 业务逻辑  
});

process.on('uncaughtException', function (err) {
  logger.error(err);
});
```
这个时候，虽然我们可以记录下这个错误的日志，且进程也不会异常退出，但是我们是没有办法对发现错误的请求友好返回的，只能够让它超时返回。  

#### domain   
在node v0.8+版本的时候，发布了一个模块`domain`。这个模块做的就是`try catch`所无法做到的：捕捉异步回调中出现的异常。   
于是乎，我们上面那个无奈的例子好像有了解决的方案：   

```js
var domain = require('domain');

//引入一个domain的中间件，将每一个请求都包裹在一个独立的domain中
//domain来处理异常
app.use(function (req,res, next) {
  var d = domain.create();
  //监听domain的错误事件
  d.on('error', function (err) {
    logger.error(err);
    res.statusCode = 500;
    res.json({sucess:false, messag: '服务器异常'});
    d.dispose();
  });
  
  d.add(req);
  d.add(res);
  d.run(next);
});

app.get('/index', function（req, res） {
  //处理业务
});
```

我们通过中间件的形式，引入domain来处理异步中的异常。当然，domain虽然捕捉到了异常，但是还是由于异常而导致的堆栈丢失会导致内存泄漏，所以出现这种情况的时候还是需要重启这个进程的，有兴趣的同学可以去看看[domain-middleware](https://github.com/fengmk2/domain-middleware)这个domain中间件。  

### 诡异的失效    
我们的测试一切正常，当正式在生产环境中使用的时候，发现`domain`突然失效了！它竟然没有捕获到异步中的异常，最终导致进程异常退出。经过一番排查，最后发现是由于引入了redis来存放session导致的。   

```js
var http = require('http');
var connect = require('connect');
var RedisStore = require('connect-redis');
var domainMiddleware = require('domain-middleware');

var server = http.createServer();
var app = connect();
app.use(connect.session({
  key: 'key',
  secret: 'secret',
  store: new RedisStore(6379, 'localhost')
}));
//domainMiddleware的使用可以看前面的链接
app.use(domainMiddleware({
  server: server,
  killTimeout: 30000
}));
```

此时，当我们的业务逻辑代码中出现了异常，发现竟然没有被`domain`捕获！经过一番查找，终于将问题定位到了__网络IO之后的回调中异常__是无法被这样使用的`domain`捕获到的:   

```js
var domain = require('domain');
var redis = require('redis');
var cache = redis.createClient(6379, 'localhost');

function error() {
  cache.get('a', function () {
    throw new Error('something wrong');
  });
}

function ok () {
  setTimeout(function () {
    throw new Error('something wrong');
  }, 100);
}
var d = domain.create();
d.on('error', function (err) {
  console.log(err);
});

d.run(ok);    //domain捕获到异常
d.run(error); //异常被抛出
```

奇怪了！，都是异步调用，为什么前者被捕获，后者却没办法捕获到呢？  

