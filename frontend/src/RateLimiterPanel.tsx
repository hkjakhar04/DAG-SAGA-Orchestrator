import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity } from 'lucide-react';

interface BucketStatus {
    currentCapacity: number;
    maxCapacity: number;
}

const RateLimiterPanel: React.FC = () => {
    const [status, setStatus] = useState<Record<string, BucketStatus>>({});

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`http://${window.location.hostname}:8080/status`);
                setStatus(res.data);
            } catch (e) {
                // Ignore silently, might be down
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-surface p-4 rounded-xl border border-gray-700 w-full h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-gray-200">
                <Activity size={20} className="text-primary" />
                <h2 className="font-semibold text-lg">C++ Rate Limiter</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4">
                {Object.keys(status).length === 0 && (
                    <div className="text-sm text-gray-400">Waiting for data...</div>
                )}
                {Object.entries(status).map(([key, bucket]) => {
                    const percentage = Math.max(0, Math.min(100, (bucket.currentCapacity / bucket.maxCapacity) * 100));
                    
                    return (
                        <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-300 font-mono">{key}</span>
                                <span className="text-gray-400">{bucket.currentCapacity.toFixed(1)} / {bucket.maxCapacity.toFixed(1)} tokens</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-300 ease-in-out"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RateLimiterPanel;
