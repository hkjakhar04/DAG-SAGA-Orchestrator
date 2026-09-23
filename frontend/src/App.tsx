import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import DAGVisualizer from './DAGVisualizer';
import { Play, Database, History, Filter } from 'lucide-react';

const App: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [liveState, setLiveState] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const newSocket = io(`http://${window.location.hostname}:3001`);
        setSocket(newSocket);

        newSocket.on('taskStateChanged', ({ runId, state }) => {
            // CRUCIAL: Filter incoming socket events by the active runId
            setActiveRunId((currentActiveRunId) => {
                if (currentActiveRunId === runId || currentActiveRunId === null) {
                    setLiveState(state);
                    // Automatically switch to the first runId we see if none is selected
                    return runId; 
                }
                return currentActiveRunId;
            });
        });

        fetchHistory();
        const historyInterval = setInterval(fetchHistory, 3000); // Polling for history

        return () => {
            newSocket.disconnect();
            clearInterval(historyInterval);
        };
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`http://${window.location.hostname}:3001/api/history`);
            setHistory(res.data.reverse()); // Latest first
        } catch (e) {
            console.error('Failed to fetch history');
        }
    };

    const startWorkflow = async () => {
        try {
            const res = await axios.post(`http://${window.location.hostname}:3000/api/start`);
            setActiveRunId(res.data.runId);
            setLiveState(null); // Clear previous state until socket pushes
        } catch (e) {
            console.error('Failed to start workflow');
        }
    };

    return (
        <div className="min-h-screen bg-background text-gray-100 flex p-6 gap-6 h-screen overflow-hidden">
            
            {/* LEFT SIDEBAR: History */}
            <div className="w-1/4 max-w-sm bg-surface border border-gray-700 rounded-xl flex flex-col overflow-hidden shadow-xl shadow-black/50">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-slate-800">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-primary" />
                        <h2 className="font-semibold">Run History</h2>
                    </div>
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 font-mono">
                        Total: {history.length}
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {history.map((run, i) => (
                        <div 
                            key={run.runId} 
                            onClick={() => {
                                setActiveRunId(run.runId);
                                setLiveState(run);
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                activeRunId === run.runId 
                                ? 'bg-primary/20 border-primary' 
                                : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-mono text-gray-400 break-all pr-2">
                                    {run.runId.substring(0, 8)}...
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                    run.status === 'Completed' ? 'bg-success/20 text-success' :
                                    run.status === 'Failed' || run.status === 'RolledBack' ? 'bg-danger/20 text-danger' :
                                    run.status === 'Running' ? 'bg-primary/20 text-primary' :
                                    'bg-warning/20 text-warning'
                                }`}>
                                    {run.status}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500">
                                {new Date(run.startTime).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <div className="text-gray-500 text-sm text-center mt-10">No history yet</div>}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                
                {/* Header / Actions */}
                <div className="bg-surface border border-gray-700 rounded-xl p-4 flex justify-between items-center shadow-xl shadow-black/50">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                            Travel Saga Orchestrator
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">DAG Execution with SAGA Rollback</p>
                    </div>
                    <button 
                        onClick={startWorkflow}
                        className="flex items-center gap-2 bg-primary hover:bg-blue-600 transition-colors px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary/30"
                    >
                        <Play size={18} />
                        Start Workflow
                    </button>
                </div>

                {/* Dashboard Grid */}
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* DAG View */}
                    <div className="flex-1 h-full shadow-xl shadow-black/50 rounded-xl flex flex-col relative border border-gray-700">
                        {/* Current Filter Indicator */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-600 shadow-md">
                            <Filter size={14} className="text-primary" />
                            <span className="text-xs text-gray-200 font-mono">
                                Viewing: {activeRunId ? activeRunId : 'None'}
                            </span>
                        </div>
                        <DAGVisualizer workflowState={liveState} />
                    </div>

                    {/* Right Column: Stats */}
                    <div className="w-80 flex flex-col gap-6">
                        <div className="h-full bg-surface border border-gray-700 rounded-xl p-4 shadow-xl shadow-black/50 text-sm text-gray-300">
                            <div className="flex items-center gap-2 mb-4">
                                <Database size={18} className="text-success" />
                                <h3 className="font-semibold text-lg">In-Memory Storage</h3>
                            </div>
                            <div className="flex gap-3 mb-4">
                                <div className="bg-success/20 text-success px-3 py-2 rounded-lg flex-1 text-center">
                                    <div className="text-xl font-bold">{history.filter(h => h.status === 'Completed').length}</div>
                                    <div className="text-xs uppercase font-semibold mt-1">Succeeded</div>
                                </div>
                                <div className="bg-danger/20 text-danger px-3 py-2 rounded-lg flex-1 text-center">
                                    <div className="text-xl font-bold">{history.filter(h => h.status === 'RolledBack' || h.status === 'Failed').length}</div>
                                    <div className="text-xs uppercase font-semibold mt-1">Failed</div>
                                </div>
                                <div className="bg-primary/20 text-primary px-3 py-2 rounded-lg flex-1 text-center">
                                    <div className="text-xl font-bold">{history.filter(h => h.status === 'Running' || h.status === 'Compensating').length}</div>
                                    <div className="text-xs uppercase font-semibold mt-1">Active</div>
                                </div>
                            </div>
                            <p className="mb-2">The orchestrator is tracking <strong>{history.length}</strong> total workflows in memory via a native Node.js Map.</p>
                            <p className="text-gray-400 text-xs mt-4">
                                This dashboard filters incoming Socket.IO events by the active <code>runId</code> to prevent UI glitching under high concurrency load tests.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default App;
