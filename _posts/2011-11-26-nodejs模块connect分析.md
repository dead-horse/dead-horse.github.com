---
title:nodejs模块connect分析
summary:结合connect（v 1.8）的源码，对connect这一个高扩展性的nodejs web中间件框架进行分析，包括其部分重要中间件。
keyword:nodejs,connect,middleware
layout:post
---

###简介
connect是基于nodejs的一个轻量级web中间件框架，代码简洁，扩展性高，在其1.x版本可以独立作为一个完整的web框架搭建rest网站。
其提供了router/static/bodyparser/cookieparser/session等基础中间件服务。
但是在它升级到2.0之后，去除了一些中间件，专注于为express等web框架提供底层的支撑。
下面通过对connect1.8的代码进行一定的分析，来了解基于nodejs的web程序是如何驱动的。    

###使用方法
先来看一下connect的使用方法。
{% highlight javascript %}
var connect = require('connect');
var app = connect.createServer(); //create server
app.use(connect.static(__dirname + '/public', { maxAge: 0 })); //import static server
app.use(function(req, res， next){
  res.end('Hello world');
});
{% endhighlight %}
可以看出，它和express的使用方法是非常类似的，（express就是架设在connect之上的一个大型web框架）。   

###connect实现思路
connect继承自http/https。通过connect创建一个http|https server，提供http server的所有功能。    
在server收到请求触发request事件的时候，connect开始执行它的中间件。
中间件的一般形式是：
{% highlight javascript %}
function middleware(options){
  var options = options || {};  
  connect.utils.merge(defaultOptions, options);  //中间件的配置
  return function(req, res, next){ //如果调用了next，就会执行之后的中间件
    
  }
}
connect.use('/', middleware(options));  //引入中间件
{% endhighlight %}
在同一个server上可以引入多个中间件，它们都是跟某个path绑定，根据不同的请求url，被调用的中间件也可能会不同。
中间件是串行执行的，可以一直链式执行到底(一直next)也可以中途返回response跳过后面的。因此中间件的绑定顺序也是相当重要的。   
在connect中，所有通过connect.use(route, handle)被引入的中间件handle，都与对应的route结合为一个对象，存放在栈中，每个请求过来的时候，
从栈中顺序取出path与请求url相匹配的handle执行，直到未被handle调用next()释放或者全部handle执行完成。   

###扩展
从connect的设计思路上来看，中间件的扩展是非常容易的，只需要按照它的规则就可以写出自己想要的中间件并融入其中。   

###实现
下面是connect的主体代码（HTTP部分），实现简洁。   
{% highlight javascript %}
function createServer() {
  if ('object' == typeof arguments[0]) {
    return new HTTPSServer(arguments[0], Array.prototype.slice.call(arguments, 1));
  } else {
    return new HTTPServer(Array.prototype.slice.call(arguments));
  }
};
{% endhighlight %}
HTTPSServer和HTTPServer基本一致，只是HTTPSServer封装的https的方法。在createServer的时候，同样可以传递进去一系列的中间件，和随后引入的效果是一样的，不过却只能绑定到根目录上。   

{% highlight javascript %}
/***
 * 先把创建时传递进来的中间件存入stack，然后用HTTPServer调用http.Server初始化，
 * 并绑定requestListener为后面将会出现的handle方法。
 */
var Server = exports.Server = function HTTPServer(middleware) {
  this.stack = [];
  middleware.forEach(function(fn){
    this.use(fn);
  }, this);
  http.Server.call(this, this.handle);
};
//继承http server,此时的HTTPServer已经和http.Server一样了（除了requestListener绑定到了this.handle）
Server.prototype.__proto__ = http.Server.prototype; 
/***
 *      connect.createServer()
 *        .use(connect.favicon())
 *        .use(connect.logger())
 *        .use(connect.static(__dirname + '/public'))
 *        .listen(3000); 
 * 通过use方法，把中间件的handle与route结合后压入栈中。
 * @param {String|Function} route or handle, if
 * @param {Function} handle
 * @return {Server}
 */
Server.prototype.use = function(route, handle){
  this.route = '/';

  // default route to '/'
  if ('string' != typeof route) {
    handle = route;
    route = '/';
  }
  // wrap sub-apps
  if ('function' == typeof handle.handle) {
    var server = handle;
    server.route = route;
    handle = function(req, res, next) {
      server.handle(req, res, next);
    };
  }

  // wrap vanilla http.Servers
  if (handle instanceof http.Server) {
    handle = handle.listeners('request')[0];
  }

  // normalize route to not trail with slash
  if ('/' == route[route.length - 1]) {
    route = route.substr(0, route.length - 1);
  }

  // add the middleware
  this.stack.push({ route: route, handle: handle });
  // allow chaining
  return this;
};
/***
 *  每次收到request请求，就会调用此方法，遍历stack，寻找path与请求url想匹配的项，执行handle。
 */
Server.prototype.handle = function(req, res, out) {
  var writeHead = res.writeHead
    , stack = this.stack
    , removed = ''
    , index = 0;
  function next(err) {
    var layer, path, c;
    req.url = removed + req.url;
    req.originalUrl = req.originalUrl || req.url;
    removed = '';

    layer = stack[index++];

    // all done
    if (!layer || res.headerSent) {
      // but wait! we have a parent
      if (out) return out(err);

      // error
      if (err) {
        var msg = 'production' == env
          ? 'Internal Server Error'
          : err.stack || err.toString();

        // output to stderr in a non-test env
        if ('test' != env) console.error(err.stack || err.toString());

        // unable to respond
        if (res.headerSent) return req.socket.destroy();

        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        if ('HEAD' == req.method) return res.end();
        res.end(msg);
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        if ('HEAD' == req.method) return res.end();
        res.end('Cannot ' + req.method + ' ' + req.url);
      }
      return;
    }

    try {
      path = parse(req.url).pathname;
      if (undefined == path) path = '/';

      // skip this layer if the route doesn't match.
      if (0 != path.indexOf(layer.route)) return next(err);

      c = path[layer.route.length];
      if (c && '/' != c && '.' != c) return next(err);

      // Call the layer handler
      // Trim off the part of the url that matches the route
      removed = layer.route;
      req.url = req.url.substr(removed.length);

      // Ensure leading slash
      if ('/' != req.url[0]) req.url = '/' + req.url;

      var arity = layer.handle.length;
      if (err) {
        if (arity === 4) {
          layer.handle(err, req, res, next);
        } else {
          next(err);
        }
      } else if (arity < 4) {
        layer.handle(req, res, next);
      } else {
        next();
      }
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        console.error(e.stack + '\n');
        next(e);
      } else {
        next(e);
      }
    }
  }
  next();
};
{% endhighlight %}

EOF