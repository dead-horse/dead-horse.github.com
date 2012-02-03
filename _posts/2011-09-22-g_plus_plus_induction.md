---
layout : post
category : cpp
title : g++基础知识
summary : 一些简单的g++编译命令与常用选项的作用。
keywords : c++,g++
author : dead_horse
---
###编译过程： 
1. 预处理，生成.i文件   
2. 转换成为汇编语言，生成.s文件   
3. 汇编变为目标代码（机器代码），生成.o文件   
4. 链接目标代码，生成可执行程序。   

###常用编译选项   
tips：选项必须独立给出：‘-pg’和‘-p -g’完全不同    

 * -c：编译或汇编源文件，不做连接。 
   * G++ -c test.cpp输出test.o   
 * -o file：制定输出文件为file  
 * -Wall： 输出所有编译警告（最好加上）   
 * -Dmacro=XXX：定义宏。  
 * -shared：生成一个共享库文件 
 * g++ -shared -o libtest.so test.o  
 * -fPIC：生成位置无关目标代码，适用于动态连接。   
 * -llibrarytest：连接名字为librarytest的库   
    * 真正名字是liblibrarytest.so(a) so是动态库，a是静态库。 严格按照文件名搜索，版本号要创建软连接。 
    * 编译搜索目录：
       * 用户-L指定， LIBRARY_PATH，系统目录/lib  /usr/lib 
    * 运行搜索目录：
       * LD_LIBRARY_PATH，ld.so.cache & /etc/ld.so.conf ，系统目录  /lib  /usr/lib 
    * 动态库和静态库同名，优先动态库。  
 * -Ldir：添加库文件搜索路径 -Idir（include）：添加头文件搜索路径   
 * -g：产生调试信息   
 * -olevel：优化级别，一般用o2    

###静态库、共享库 
*静态库：一些.o文件打包，在被连接后成为程序的一部分。 
   编译方法 
     * -g++ -c test.cpp  
     * -ar res libtest.a test.o  
   链接方法： 
     * -g++ -Wall -o test testMain.cpp -ltest -L./  
*共享库：链接的时候不会被复制到程序中。 
   编译方法： 
     * g++ -c fPIC test.cpp	
     * //要动态 g++ -shared -WI, -soname, libtest.so, -o libtest.so.1.0.1 test.o 
     * mv libtest.so.1.0.1 /usr/lib 
     * sudo ldconfig & || ll /user/lib/libtest.so //创建一个软连接。     
   链接方法：
     * g++ -o test test.cpp ./libtest.so -ldx_cxx  

###常用命令 
 * ldd：显示程序依赖的同台共享库。  
 * file：查看文件格式信息。  
 * ldconfig：在搜寻目录下搜索出可以共享的动态链接库 
