###简介
connect是一个nodejs的轻量级web中间件框架，提供了router(1.x),logger,static,bodyparser,cookieparser等10多个实用的中间件，可以通过他快速的构建REST网站，相较于express，代码更为精简，容易理解和扩展。   
以下分析基于connect(1.8)，由于connect2.0版本去除了router，并且基础实现方式有点变化，变得更加轻量级了，更多的作用是作为express的底层服务来实现了。

###使用方法：
{% highlight javascript %}
var connect = require('connect');

connect(
connect.static(__dirname + '/public', { maxAge: 0 })
, function(req, res) {
res.setHeader('Content-Type', 'text/html');
res.end('<img src="/tobi.jpeg" />')
}
).listen(3000);
{% endhighlight %}
 
思路：
通过connect创建一个http|https server，提供http server的所有功能。
connect是原型继承于http server的，它会用use到的中间件替换掉server的requestListener。
通过connect.use(route, handle)来对每一个路由添加中间件，这些中间件handle会与route绑定保存在一个stack里面，每次有request请求的时候，遍历这个堆，找到对应route的handle，执行handle，如果handle最后调用了next(),就会继续寻找并执行下一个匹配的handle。
通过封装handle，可以很容易的在connect基础上添加更多的middleware。
 
connect.js
有一个createServer方法，可以通过connect()访问到。根据第一个参数，如果是object，就当作是https的选项，创建HTTPSServer，如果第一个参数不是object，则创建HTTPServer，所有的参数（除了https的选项）都是一个中间件handle，会在HTTPServer绑定到‘/’路径上。
HTTPSServer是在HTTPServer的基础上添加了一层，可以启用HTTPS服务。
同时，connect.js会读取middleware文件夹，把里面的中间件读取到，为他们创建getter,可以通过connect.static()访问到。
而每一个中间件文件暴露在外的函数都是返回一个handle。
 
http.js
HTTPServer：初始化的时候会把所有的参数当作handle存放进stack，然后以handle方法为requestListener调用http.Server方法。
HTTPServer随后会继承http.Server的原型。
use(route, handle)
把handle去除外壳之后绑定到route上面，存入stack中。
handle(req, res, next)
遍历整个stack，寻找到req.url与route匹配的元素，执行它的handle。当所有的元素都遍历完还有错误，则输出。
 
util.js
这是一个工具包，里面包含了用到的各种工具函数。
pause(obj)
把传递进来的obj对象的'data'和'end'事件都保存下来，返回两个函数：end()：不再保存事件。resume()：停止保存并把之前保存的事件释放出去给obj再次捕获，达到暂停这个obj对象的效果。（感觉可能会有bug,如果在这里释放的时候又有'data'或者'end'事件触发会不会导致顺序变乱？）
parseCookie(str)
把str以;或者，为分隔符分开。每一个都是一个cookie键值对，然后再以=分开。去除value的引号。每个键只能被取得一次。

中间件:

router
connect的route使用方法和express类似。
1 connect(connect.route(function(app){
2     app.get('/:id', middle1, middle2, cb);
3     app.post('/admin', cbpost);
4 }));

route.js内有一个_methods数组，存放所有的route请求方法名称。（get/post/put/...）。
methods对象和routes对象根据_methods内的名称，包含着响应的元素，如：methods['get'], routes['get']。

methods对象，根据_methods数组内的方法名称，为每一个方法调用来一个生产函数，这个函数首先把routes对象内的成员赋值[]，然后返回一个函数，这个函数用来产生routes的内容。
methods还有一个元素param,调用它可以为path中出现了某个param的时候设置对应的处理方法。
例如：
app.param('id', function(req, res, next, val){})，
当path中有param id出现的时候，会先调用这个注册的函数再进行后面的操作。

在进行完上述对象的初始化之后，route模块会进行fn.call(this, methods)的调用,即用methods作为参数调用传递进来的匿名函数。所以在app.get('/:id', cb, cb1);的时候，实际调用的是methods.get('/:id', cb, cb1)，而methods.get即是之前生产函数的返回函数。
这个函数的处理：cb为这条路由的handle，middle1..middle2..等中间件函数将会存放在cb.middleware数组中(这里会产生一个bug)。然后把'/'转化成为正则对象，然后在转化正则的时候，可能会遇到路径里面有:id等key，会把这些key存放到keys里面。
最终的routes内将会多处一条routes['GET']的记录：
 
GET:
[ { fn: [Object],
path: /^\/(?:([^\/]+?))\/?$/i,
keys: [Object],
orig: '/:id',
method: 'GET' } ]
 
刚才说会产生一个bug，是当有两条以上的route以cb作为handle的时候：
app.get('/:id', middle1, middle2, cb);
app.get('/:id/test', middle3, cb);
因为最终的handle都是cb，此时cb的middleware数组会在第二次处理get的时候把第一次的覆盖掉，造成第一次的middleware被替换。

至此，所有的准备工作完成了，然后会返回一个router函数作为handle。

实际request请求触发的时候：

作为handle的router函数被调用，先通过match(req, routes, i)函数，查找req.method对应方法的route的path，与req.pathName匹配。找到路径匹配的把这个route内的这个对象内的fn，同时把keys params method存放到fn里面整合称为一个route返回。返回的route内容形式为
{ [Function]
  middleware: [ [Function], [Function] ],
  keys: [ 'id' ],
  method: 'GET',
  params: [ id: 'ca' ] }
然后函数去寻找是否通过methods.param定义了这条route中的param的处理函数，如果有，在这里就执行完对应param的处理函数。之后执行middleware数组内的函数，最后执行这个route。即上一段中说到的fn。这之中能够链式执行下去的条件是中间函数都执行了next()，继续调用下去，当然也可以其中某个函数就结束整个处理。

bodyParser

bodyParser用来解析post方法传递过来的参数。
只接受mime类型为
application/x-www-form-urlencoded
application/json
multipart/form-data
三种的非GET和HEAD请求。

application/x-www-form-urlencoded通过模块qs.parse来解析。
application/json通过JSON.parse解析。
multipart/form-data是文件上传，通过formidable解析。


static
static是一个静态文件服务器。
connect.static(root, options)会产生一个handle，handle设置默认的options然后调用send函数。

options内容：
root:静态服务器的根路径，必须由connect.static传入。
path:访问的文件路径
getOnly:访问方法限制（默认是true：只允许get方法访问 ）
maxAge:时间限制
redirect:在访问的路径是目录的时候，如果允许redirect，则会redirect到这个目录下的index.html文件，默认为true
callback:在每次静态服务之后调用的函数（包括发生错误，发生错误之后不会再调用next）。
hidden:是否允许访问隐藏文件（默认为false）

根据这些参数来决定访问限制。

支持conditional和range。

最终通过
var stream = fs.createReadStream(path, opts);
stream.pipe(res);
管道的方式来传送文件内容。
 
