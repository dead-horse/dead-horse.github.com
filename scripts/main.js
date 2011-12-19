$(function(){
  getKeyWords();
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
        blog.hide();
      }
    }
  })
}
