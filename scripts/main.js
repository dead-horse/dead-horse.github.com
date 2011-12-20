$(function(){
  getKeyWords();
  getCloud();
})

/***
 * 从keywords字符串获取keywords
 */
function getKeyWords(){
  var arrKeyWords = $('.keywords');
  for(var i=0, len=arrKeyWords.length; i!=len; ++i){
    var keyWords = $(arrKeyWords[i]);
    var words = keyWords.html().split(',');
    for(var j=0, wlen=words.length; j!=wlen; ++j){
      words[j] = '<a href="javascript:void(0);" class="key-word">'+ words[j] +'</a>';
    }
    keyWords.html('keyWords: ' + words.join(' '));
  }
  bindClick();
}
/***
 * 绑定点击关键词事件
 */
function bindClick(){
  var blogs = $('.bloginf');
  $('.key-word').bind('click', function(){
    var word = $(this).text();
    for(var i=0, len=blogs.length; i!=len; ++i){
      var blog = $(blogs[i]);
      var words = blog.find('.key-word');
      for(var j=0, wlen=words.length; j!=wlen; j++){
        if($(words[j]).text()===word){
          break;
        }
      }
      if(j===wlen){
        blog.hide('normal');
      }else{
        blog.show('normal');
      }
    }
  })
}
/***
* 生成标签云的tags
*/
function getCloud(){
  var words = [];
  var arrKeyWords = $('.post-keywords');
  //get all the key words
  for(var i=0, len=arrKeyWords.length; i!=len; ++i){
    var keyWords = $(arrKeyWords[i]);
    words = words.concat(keyWords.html().split(','));
  }
  //get the tags {keywords:num}
  var tags= {};
  for(var i=0, len=words.length; i!=len; ++i){
    var word = words[i];
    tags[word] = tags[word] ? tags[word]+1 : 1;
  }
  //genarate the cloud element
  var minSize = 10, maxSize = 15, maxNum=-1, minNum=10000;
  words = [];
  for(var key in tags){
    var num = tags[key];
    maxNum = num>maxNum ? num : maxNum;
    minNum = num<minNum ? num : minNum;
  }
  var times = (maxSize-minSize)/(maxNum-minNum);
  var htmls = [];
  for(var key in tags){
    var size = Math.ceil((tags[key]-1)*times) + minSize;
    htmls.push('<a href="javascript:void(0)" class="key-word" style="font-size:');
    htmls.push(size);
    htmls.push('px">');
    htmls.push(key);
    htmls.push('</a>');
  }
  $('#cloud-tags').html(htmls.join(''));
    bindClick();
}