import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// Configurable failure rate (0.0 to 1.0)
const FAILURE_RATE = 0.05;

// Middleware to simulate random failures
const simulateFailure = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (Math.random() < FAILURE_RATE) {
        console.log(`[SIMULATED FAILURE] ${req.method} ${req.url}`);
        return res.status(500).json({ error: 'Internal Server Error (Simulated)' });
    }
    // Simulate slight network delay (20-100ms)
    setTimeout(next, 20 + Math.random() * 80);
};

// Apply simulated failure and delay to all routes
app.use(simulateFailure);

// --- Airline Endpoints ---
app.post('/airline/book', (req, res) => {
    res.json({ success: true, ref: 'AIR-' + Math.random().toString(36).substring(7) });
});
app.post('/airline/cancel', (req, res) => {
    // Compensations should ideally be more reliable, but we'll apply the same failure logic
    // for simplicity, though in a real system they retry heavily.
    res.json({ success: true, message: 'Flight cancelled' });
});

// --- Hotel Endpoints ---
app.post('/hotel/book', (req, res) => {
    res.json({ success: true, ref: 'HOTEL-' + Math.random().toString(36).substring(7) });
});
app.post('/hotel/cancel', (req, res) => {
    res.json({ success: true, message: 'Hotel cancelled' });
});

// --- Cab Endpoints ---
app.post('/cab/book', (req, res) => {
    res.json({ success: true, ref: 'CAB-' + Math.random().toString(36).substring(7) });
});
app.post('/cab/cancel', (req, res) => {
    res.json({ success: true, message: 'Cab cancelled' });
});

// --- Bank Endpoints ---
app.post('/bank/charge', (req, res) => {
    res.json({ success: true, transactionId: 'TXN-' + Math.random().toString(36).substring(7) });
});
app.post('/bank/refund', (req, res) => {
    res.json({ success: true, message: 'Refund processed' });
});

// --- Notification Endpoints ---
app.post('/notify/airline', (req, res) => {
    res.json({ success: true });
});
app.post('/notify/hotel', (req, res) => {
    res.json({ success: true });
});
app.post('/notify/itinerary', (req, res) => {
    res.json({ success: true });
});

// For compensation tasks where no rollback is strictly required, they can just return 200.

app.listen(PORT, () => {
    console.log(`Mock Downstream API running on http://localhost:${PORT}`);
    console.log(`Simulated Failure Rate: ${FAILURE_RATE * 100}%`);
});
