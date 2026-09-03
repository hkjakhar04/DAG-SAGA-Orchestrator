#include "RateLimiter.h"
#include <algorithm>
#include <iostream>

RateLimiter::RateLimiter(double defaultPermitsPerSecond, const std::unordered_map<std::string, RateConfig>& keyRates) {
    defaultMaxPermits_ = defaultPermitsPerSecond;
    defaultStableIntervalMicros_ = 1000000.0 / defaultPermitsPerSecond;
    for (const auto& pair : keyRates) {
        keyMaxPermits_[pair.first] = pair.second.capacity;
        keyStableIntervalMicros_[pair.first] = 1000000.0 / pair.second.refillRate;
    }
    InitializeCriticalSection(&cs_);
}

RateLimiter::~RateLimiter() {
    DeleteCriticalSection(&cs_);
}

long long RateLimiter::nowMicros() {
    return std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::steady_clock::now().time_since_epoch()
    ).count();
}

void RateLimiter::resync(const std::string& key, long long nowMicros, BucketState& state) {
    if (nowMicros > state.nextFreeTicketMicros) {
        double interval = keyStableIntervalMicros_.count(key) ? keyStableIntervalMicros_[key] : defaultStableIntervalMicros_;
        double maxPermits = keyMaxPermits_.count(key) ? keyMaxPermits_[key] : defaultMaxPermits_;
        double newPermits = (nowMicros - state.nextFreeTicketMicros) / interval;
        state.storedPermits = std::min(maxPermits, state.storedPermits + newPermits);
        state.nextFreeTicketMicros = nowMicros;
    }
}

long long RateLimiter::reserveEarliestAvailable(const std::string& key, int permits, long long nowMicros) {
    EnterCriticalSection(&cs_);
    
    if (states_.find(key) == states_.end()) {
        double maxPermits = keyMaxPermits_.count(key) ? keyMaxPermits_[key] : defaultMaxPermits_;
        states_[key] = {maxPermits, nowMicros};
    }
    
    BucketState& state = states_[key];
    resync(key, nowMicros, state);
    
    long long returnValue = state.nextFreeTicketMicros;
    
    double interval = keyStableIntervalMicros_.count(key) ? keyStableIntervalMicros_[key] : defaultStableIntervalMicros_;
    double storedPermitsToSpend = std::min((double)permits, state.storedPermits);
    double freshPermits = permits - storedPermitsToSpend;
    long long waitMicros = (long long)(freshPermits * interval);
    
    state.nextFreeTicketMicros += waitMicros;
    state.storedPermits -= storedPermitsToSpend;
    
    LeaveCriticalSection(&cs_);
    return returnValue;
}

long long RateLimiter::acquire(const std::string& key, int permits) {
    long long now = nowMicros();
    long long momentAvailable = reserveEarliestAvailable(key, permits, now);
    
    long long waitMicros = momentAvailable - now;
    if (waitMicros < 0) {
        return 0;
    }
    
    return (waitMicros + 999) / 1000;
}

std::unordered_map<std::string, RateLimiter::Status> RateLimiter::getStatus() {
    EnterCriticalSection(&cs_);
    long long now = nowMicros();
    std::unordered_map<std::string, Status> result;
    
    for (auto& pair : states_) {
        BucketState copy = pair.second;
        resync(pair.first, now, copy);
        double maxPermits = keyMaxPermits_.count(pair.first) ? keyMaxPermits_[pair.first] : defaultMaxPermits_;
        result[pair.first] = {copy.storedPermits, maxPermits};
    }
    
    LeaveCriticalSection(&cs_);
    return result;
}
