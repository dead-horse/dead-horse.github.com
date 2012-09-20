---
layout : post
category : nodejs 
title : XSS等web安全漏洞的防范   
summary : 记录最近遇到的XSS和文件上传等漏洞，以及在node中的实际案例和防范方法。    
keywords : nodejs,web安全,XSS
author : dead_horse
---

最近在cnode社区，由@[吴中骅](http://weibo.com/spuout)的一篇关于XSS的[文章](http://snoopyxdy.blog.163.com/blog/static/60117440201284103022779/)，直接导致了社区的人开始在cnode尝试各种攻击。这里总结了一下这次碰到的一些问题与解决方案。   


### 文件上传漏洞   
  之前nodeclub在上传图片的时候逻辑是这样的：   

{% highlight javascript %}   
//用户上传的文件名
var filename = Date.now() + '_' + file.name;
//用户文件夹
var userDir = path.join(config.upload_dir, uid);
//最终文件保存的路径
var savepath = path.join(userDir, filename);
//将用户上传的文件从临时目录移动到最终保存路径
fs.rename(file.path, savepath, callback);
{% endhighlight %}   

看上去好像没有问题，每个人上传的文件都存放在以用户UID命名的一个文件夹内，并且以当前的时间戳作前缀。但是当有用户恶意构造输入的时候，问题就出现了。当用户上传的文件**filename**为**/../../xxx**的时候，上传的文件就会rename到用户文件夹之外，导致用户可以替换现有系统上的任何文件。   
这个漏洞相对来说非常的低级，但是后果却是最严重的，直接导致整个系统都可能被用户控制。修复的方法也很简单：   

{% highlight javascript %}   
var filename = Date.now() + '_' + file.name;
var userDir = path.join(config.upload_dir, uid);
//获取最终保存到的绝对路径
var savepath = path.resolve(path.join(userDir, filename));
//验证
if (savepath.indexOf(path.resolve(userDir)) !== 0) {
  return res.send({status: 'forbidden'});
}
fs.rename(file.path, savepath, callback);
{% endhighlight %} 

### 富文本编辑器的XSS   
关于XSS，在@[吴中骅](http://weibo.com/spuout)的[文章](http://snoopyxdy.blog.163.com/blog/static/60117440201284103022779/)中已经非常详细的描述了。而cnode社区中，用户发表话题和回复话题也是用的一个支持*markdown*格式的富文本编辑器。之前是没有做过任何XSS防范措施的，于是...你可以直接在里面写：   

{% highlight javascript %}   
<script>alert(123);</script>
<div onmouseover="alert(123)"></div>
<a href="javascript:alert(123);">123</a>
{% endhighlight %}  

而markdown格式的内容也没有做URL有效性检测，于是各种样式的XSS又出来了：   

{% highlight javascript %}
[xss][1]
[xss][2]
![xss][3]

[1]: javascript:alert(123);
[2]: http://www.baidu.com/#"onclick='alert(123)'
[3]: http://www.baidu.com/img.jpg#"onmouseover='alert(123)'
{% endhighlight %}  

在社区这个应用场景下，引入HTML标签只是为了进行一些排版的操作，而其他的样式定义等等都只会让整个界面一团糟，更别说还有潜在的XSS漏洞风险。因此，其实我们是不需要支持用户输入HTML标签来进行内容排版的，一切都可以通过markdown来代替。然后通过简单粗暴的HTML escape，就可以消灭掉直接输入HTML导致的XSS风险。

{% highlight javascript %} 
function escape(html) {
  return html.replace(/&(?!\w+;)/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;');
}
{% endhighlight %} 

然而这样粗暴的进行escape，会导致用户输入的代码里面的**< > ;**这些特殊字符也被转义掉，不能正确显示，需要先将代码段提取出来保存，只转义非代码段的部分。于是这个*escape*函数变成了这样：   

{% highlight javascript %} 
function escape(html) {
  var codeSpan = /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm;
  var codeBlock = /(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g;
  var spans = [];
  var blocks = [];
  var text = String(html).replace(/\r\n/g, '\n')
  .replace('/\r/g', '\n');
  
  text = '\n\n' + text + '\n\n';

  text = text.replace(codeSpan, function(code) {
    spans.push(code);
    return '`span`';
  });

  text += '~0';

  return text.replace(codeBlock, function (whole, code, nextChar) {
    blocks.push(code);
    return '\n\tblock' + nextChar;
  })
  .replace(/&(?!\w+;)/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/`span`/g, function() {
    return spans.shift();
  })
  .replace(/\n\tblock/g, function() {
    return blocks.shift();
  })
  .replace(/~0$/,'')
  .replace(/^\n\n/, '')
  .replace(/\n\n$/, '');
};
{% endhighlight %} 

而对于markdown生成的**&lt;a&gt;**标签和**&lt;img&gt;**标签中的href属性，必须要做URL有效性检测或者做xss的过滤。这样保证通过markdown生成的HTML代码也是没有XSS漏洞的。   

因为XSS的手段确实比较多，见[XSS Filter Evasion Cheat Sheet](https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet)。因此能够做粗暴的HTML escape是最安全的，但是并不是每一个地方都可以通过markdown来代替HTML代码，所以不是每一个地方都能用HTML escape，这个时候就需要其他的手段来过滤XSS漏洞了。   

* XSS防范只能通过定义白名单的形式，例如只允许**&lt;p&gt; &lt;div&gt; &lt;a&gt;**标签，只允许**href class style**属性。然后对每一个可能造成XSS的属性进行特定的过滤。   

* 现有的XSS过滤模块，一个是[node-validator](https://github.com/chriso/node-validator), 一个是@[雷宗民](http://weibo.com/ucdok)写的[js-xss](https://github.com/leizongmin/js-xss)。   
   
* 不能够保证XSS模块可以防范住任意的XSS攻击，但是起码能够过滤掉大部分能够想象到的漏洞。[node-validator](https://github.com/chriso/node-validator)的*XSS()*仍然有bug，对于*&lt;p on=&quot;&gt;&lt;/p&gt;*形式的代码，会有双引号不闭合的问题，导致HTML元素测漏。   

### 模版引擎导致的XSS攻击     
cnode社区采用的是ejs作为模版引擎，而在ejs中，提供了两种输出动态数据到页面的方法： 

{% highlight javascript %} 
<% =data %> //进行xss过滤的输出
<% -data %> //不过滤直接输出
{% endhighlight %} 

而所有的过滤必须有一个前提： **模版文件中的HTML属性的值等，必须使用双引号**。 例如   

{% highlight javascript %} 
<img src='<%= reply.author.avatar_url %>' title='<%= reply.author.name %>' />
<img src="<%= reply.author.avatar_url %>" title="<%= reply.author.name %>" />
{% endhighlight %} 

上面两条语句，第一句由于使用的是单引号，用户可以通过构造一个*avatar_url*中带单引号，来截断src属性，后面就可以随意加javascript代码了。   

### CSRF攻击    
CSRF攻击在node的web开发框架*connect*和*express*等中都有了解决方方案。通过在访客的session中存放一个随机的*_csrf*字段，模版引擎在生成HTML文件的时候将这个*_csrf*值传递到前端，访客提交的任意POST请求，都必须带上这个字段进行验证，保证了只有当前用户在当前页面上可以进行修改的操作。   
然而当页面存在XSS漏洞的时候，CSRF的这种防范措施就成了浮云。恶意攻击者完全可以通过javascript代码，获取到其他用户的*_csrf*值，并直接模拟用户的POST请求进行服务端数据的更改。
