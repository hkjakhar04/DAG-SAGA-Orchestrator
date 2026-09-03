@echo off
echo Starting C++ Rate Limiter...
start cmd /k "cd rate-limiter && RateLimiter.exe"

echo Starting all Node.js Services...
start cmd /k "npm run start:all"

echo All services started in separate windows!
echo Once the frontend is running, open http://localhost:5173
echo To run the load test, open a new terminal and run:
echo npm run test:load
