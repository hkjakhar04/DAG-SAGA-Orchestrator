#pragma once
#include <string>
#include <unordered_map>
#include <chrono>
#include <windows.h>

class RateLimiter {
public:
    struct RateConfig {
        double capacity;
        double refillRate;
    };

    // Initialize with a default rate, and specific per-key rates
    RateLimiter(double defaultPermitsPerSecond, const std::unordered_map<std::string, RateConfig>& keyRates);
    ~RateLimiter();
    
    // Returns 0 if allowed immediately, or the number of milliseconds to wait.
    long long acquire(const std::string& key, int permits = 1);
    
    struct Status {
        double currentCapacity;
        double maxCapacity;
    };
    
    std::unordered_map<std::string, Status> getStatus();

private:
    struct BucketState {
        double storedPermits;
        long long nextFreeTicketMicros;
    };

    double defaultMaxPermits_;
    double defaultStableIntervalMicros_;
    std::unordered_map<std::string, double> keyMaxPermits_;
    std::unordered_map<std::string, double> keyStableIntervalMicros_;
    
    CRITICAL_SECTION cs_;
    std::unordered_map<std::string, BucketState> states_;

    long long nowMicros();
    void resync(const std::string& key, long long nowMicros, BucketState& state);
    long long reserveEarliestAvailable(const std::string& key, int permits, long long nowMicros);
};
