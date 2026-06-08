 @echo off
 title 博文学习工具
 cd /d D:\claude\bowen
 echo 正在启动博文学习工具...
 echo 服务器就绪后浏览器将自动打开
 start /b cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3000"
 npm run dev
