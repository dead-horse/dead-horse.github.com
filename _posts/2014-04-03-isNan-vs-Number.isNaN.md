---
layout : post
category : nodejs,js
title : global.isNaN vs Number.isNaN
summary : global.isNaN 和 Number.isNaN 的区别
keywords : nodejs,js,NaN
author : dead_horse
---
## global.isNaN vs Number.isNaN

### TL;DR

* `global.isNaN(obj)` 会先将 obj 转换成 number，再检查是否为 NaN
* `Number.isNaN(obj)` 直接检查 obj 是否为 NaN
* 如果你想要判断一个对象本身（不转换成 number）是否真的为 NaN，请使用 `Number.isNaN(obj)`

### NaN

js 中有一个特殊的对象：`NaN`。它表示一个非法的数字（**Not-a-Number**），
它也是 js 中唯一一个 `NaN === NaN` 为 `false` 的东西。

通常，我们使用 js 提供的 `isNaN(obj)` 方法来判断一个对象是不是 NaN。
然而 es6 规范中， `Number` 对象上同样有一个 `isNaN(obj)` 的方法（node.js 支持，部分浏览器也支持）。这两个有什么区别呢？

### global.isNaN

`global.isNaN(object)` 会先将 object 转换成 number，然后再对其进行检查：

```js
global.isNaN = function (obj) {
  obj = Number(obj);
  return !(obj === obj);
}
```

对不同的对象调用 `global.isNaN`，会得到下面结果：

```js
isNaN(NaN);       // true
isNaN(undefined); // true
isNaN({});        // true

isNaN(true);      // false
isNaN(null);      // false
isNaN(37);        // false

// strings
isNaN("37");      // false: "37" is converted to the number 37 which is not NaN
isNaN("37.37");   // false: "37.37" is converted to the number 37.37 which is not NaN
isNaN("");        // false: the empty string is converted to 0 which is not NaN
isNaN(" ");       // false: a string with spaces is converted to 0 which is not NaN

// dates
isNaN(new Date());                // false
isNaN(new Date().toString());     // true

// This is a false positive and the reason why isNaN is not entirely reliable
isNaN("blabla")   // true: "blabla" is converted to a number.
                  // Parsing this as a number fails and returns NaN
```

### Number.isNaN

`Number.isNaN(obj)` 不会对 obj 做任何转换，直接进行检查：

```js
Number.isNaN = function (obj) {
  return !(obj === obj);
}
```

对不同的对象调用 `Number.isNaN`，会得到下面结果：

```js
Number.isNaN(NaN); // true
Number.isNaN(Number.NaN); // true
Number.isNaN(0 / 0) // true

// everything else: false
Number.isNaN(undefined);
Number.isNaN({});

Number.isNaN(true);
Number.isNaN(null);
Number.isNaN(37);

Number.isNaN("37");
Number.isNaN("37.37");
Number.isNaN("");
Number.isNaN(" ");
Number.isNaN("NaN");
Number.isNaN("blabla"); // e.g. this would have been true with isNaN
```

--

在使用 `isNaN` 之前，请务必想清楚检查的目的，之后再选择用哪个方法进行判断。
最后附上一个类型判断的 node
模块：[is-type-of](https://github.com/node-modules/is-type-of)。
