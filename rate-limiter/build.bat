@echo off
echo Building C++ Rate Limiter...
g++ -std=c++17 -o RateLimiter.exe main.cpp RateLimiter.cpp -lws2_32
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)
echo Build succeeded! Run RateLimiter.exe to start the server.
