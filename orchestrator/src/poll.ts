import axios from 'axios';

const TOTAL = 5000;

async function poll() {
    console.log(`Polling for completion of ${TOTAL} workflows...`);
    const start = Date.now();
    let completed = 0;
    
    while (true) {
        try {
            const res = await axios.get('http://localhost:3001/api/history');
            const workflows = res.data;
            completed = workflows.filter((w: any) => w.status === 'Completed' || w.status === 'RolledBack').length;
            
            console.log(`Completed: ${completed} / ${TOTAL}`);
            if (completed >= TOTAL) {
                const end = Date.now();
                console.log(`\n\nALL DONE!`);
                console.log(`Total Latency: ${(end - start) / 1000} seconds`);
                break;
            }
        } catch (e: any) {
            console.log(`Waiting for server to be ready on port 3001...`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

poll();
