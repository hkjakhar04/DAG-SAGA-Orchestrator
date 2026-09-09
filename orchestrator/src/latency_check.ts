import axios from 'axios';

async function checkLatency() {
    try {
        const res = await axios.get('http://localhost:3001/api/history');
        const workflows = res.data as any[];
        const completed = workflows.filter(w => w.status === 'Completed' || w.status === 'RolledBack');
        const withLatency = completed.filter(w => w.endTime && w.startTime);
        
        if (withLatency.length === 0) {
            console.log('No completed workflows with latency data');
            return;
        }
        
        const latencies = withLatency.map(w => (w.endTime - w.startTime) / 1000);
        const avg = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;
        const min = Math.min(...latencies);
        const max = Math.max(...latencies);
        
        const p50 = latencies.sort((a,b) => a-b)[Math.floor(latencies.length * 0.5)];
        const p95 = latencies.sort((a,b) => a-b)[Math.floor(latencies.length * 0.95)];
        
        console.log('=== 5k Workflow Latency Report ===');
        console.log(`Total Workflows in Primary History: ${workflows.length}`);
        console.log(`Completed/RolledBack:              ${completed.length}`);
        console.log(`With Latency Data:                 ${withLatency.length}`);
        console.log('---');
        console.log(`Avg Latency:   ${avg.toFixed(2)}s`);
        console.log(`Min Latency:   ${min.toFixed(2)}s`);
        console.log(`Max Latency:   ${max.toFixed(2)}s`);
        console.log(`p50 Latency:   ${p50.toFixed(2)}s`);
        console.log(`p95 Latency:   ${p95.toFixed(2)}s`);
        console.log('---');
        console.log(`Theoretical Min (5000wf @ 300TPS, 4 tiers): 66.67s`);
        console.log(`Event Loop Overhead: ${(avg - 66.67).toFixed(2)}s`);
    } catch(e: any) {
        console.error('Error:', e.message);
    }
}

checkLatency();
