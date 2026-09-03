import React, { useEffect, useMemo } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface DAGVisualizerProps {
    workflowState: any; // Using any for brevity, in real app type properly
}

const statusColors = {
    Pending: '#6b7280',     // Gray
    Running: '#3b82f6',     // Blue
    Success: '#10b981',     // Green
    Failed: '#ef4444',      // Red
    Compensating: '#f59e0b',// Orange
    Compensated: '#8b5cf6', // Purple
    Skipped: '#4b5563',     // Dark Gray
    undefined: '#6b7280'
};

const defaultLayout = {
    'book-flight': { x: 50, y: 50 },
    'book-hotel': { x: 250, y: 50 },
    'book-cab': { x: 450, y: 50 },
    'process-payment': { x: 250, y: 150 },
    'notify-airline': { x: 150, y: 250 },
    'notify-hotel': { x: 350, y: 250 },
    'send-itinerary': { x: 250, y: 350 },
};

const DAGVisualizer: React.FC<DAGVisualizerProps> = ({ workflowState }) => {
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!workflowState || !workflowState.tasks) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const newNodes = Object.values(workflowState.tasks).map((task: any) => {
            const pos = defaultLayout[task.id as keyof typeof defaultLayout] || { x: 0, y: 0 };
            return {
                id: task.id,
                position: pos,
                data: { label: `${task.id}\n(${task.status})` },
                style: {
                    background: statusColors[task.status as keyof typeof statusColors] || '#6b7280',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    width: 150,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s ease'
                }
            };
        });

        const newEdges: any[] = [];
        Object.values(workflowState.tasks).forEach((task: any) => {
            task.dependencies.forEach((dep: string) => {
                newEdges.push({
                    id: `e-${dep}-${task.id}`,
                    source: dep,
                    target: task.id,
                    animated: task.status === 'Running' || task.status === 'Compensating',
                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [workflowState, setNodes, setEdges]);

    return (
        <div className="w-full h-full bg-surface rounded-xl overflow-hidden border border-gray-700">
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                colorMode="dark"
            >
                <Background color="#334155" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default DAGVisualizer;
