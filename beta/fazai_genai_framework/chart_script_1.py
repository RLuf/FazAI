import plotly.graph_objects as go
import plotly.io as pio

# Create figure with larger size
fig = go.Figure()

# Define colors based on instructions
colors = {
    'processing': '#1FB8CD',  # Blue for processing
    'success': '#2E8B57',     # Green for success paths
    'error': '#DB4545',       # Red for error paths
    'decision': '#D2BA4C'     # Yellow for decision points
}

# Define node positions with better spacing - redesigned for clearer flow
nodes = [
    # Start and initialization - top row
    {'id': 'start', 'text': 'User Submits<br>Task Description', 'x': 6, 'y': 20, 'type': 'processing', 'width': 2.2, 'height': 1.2},
    {'id': 'init_check', 'text': 'Framework<br>Initialized?', 'x': 6, 'y': 17, 'type': 'decision', 'width': 2.0, 'height': 1.0},
    {'id': 'initialize', 'text': 'Initialize<br>Framework', 'x': 2, 'y': 17, 'type': 'processing', 'width': 2.0, 'height': 1.0},
    
    # Queue management
    {'id': 'queue_check', 'text': 'Task Queue<br>Empty?', 'x': 6, 'y': 14, 'type': 'decision', 'width': 2.0, 'height': 1.0},
    {'id': 'new_plan', 'text': 'Request<br>New Plan', 'x': 10, 'y': 14, 'type': 'processing', 'width': 2.0, 'height': 1.0},
    {'id': 'next_task', 'text': 'Get Next Task<br>from Queue', 'x': 6, 'y': 11, 'type': 'processing', 'width': 2.2, 'height': 1.0},
    
    # Fallback chain - horizontal layout
    {'id': 'fallback_start', 'text': 'Start Fallback<br>Chain N2', 'x': 6, 'y': 8, 'type': 'processing', 'width': 2.2, 'height': 1.0},
    {'id': 'n2_exec', 'text': 'N2: Local Mgr<br>+ Qdrant Mem', 'x': 2, 'y': 5, 'type': 'processing', 'width': 2.4, 'height': 1.0},
    {'id': 'n2_check', 'text': 'N2<br>Success?', 'x': 2, 'y': 2, 'type': 'decision', 'width': 1.6, 'height': 1.0},
    {'id': 'n3_exec', 'text': 'N3: Team Local<br>Analyst+Prog', 'x': 6, 'y': 5, 'type': 'processing', 'width': 2.4, 'height': 1.0},
    {'id': 'n3_check', 'text': 'N3<br>Success?', 'x': 6, 'y': 2, 'type': 'decision', 'width': 1.6, 'height': 1.0},
    {'id': 'n4_exec', 'text': 'N4: Online<br>Supervisor GenAI', 'x': 10, 'y': 5, 'type': 'processing', 'width': 2.6, 'height': 1.0},
    {'id': 'n4_check', 'text': 'N4<br>Success?', 'x': 10, 'y': 2, 'type': 'decision', 'width': 1.6, 'height': 1.0},
    {'id': 'n5_giveup', 'text': 'N5: Give Up', 'x': 14, 'y': 5, 'type': 'error', 'width': 2.0, 'height': 1.0},
    
    # Execution flow
    {'id': 'execute', 'text': 'Execute<br>Command', 'x': 2, 'y': -1, 'type': 'processing', 'width': 2.0, 'height': 1.0},
    {'id': 'log_result', 'text': 'Log Result<br>to Qdrant', 'x': 2, 'y': -4, 'type': 'processing', 'width': 2.2, 'height': 1.0},
    {'id': 'exec_check', 'text': 'Execution<br>Success?', 'x': 2, 'y': -7, 'type': 'decision', 'width': 2.0, 'height': 1.0},
    
    # Success/failure paths with better spacing
    {'id': 'more_tasks', 'text': 'More Tasks<br>in Queue?', 'x': 6, 'y': -10, 'type': 'decision', 'width': 2.2, 'height': 1.0},
    {'id': 'task_complete', 'text': 'Task<br>Complete', 'x': 10, 'y': -10, 'type': 'success', 'width': 2.0, 'height': 1.0},
    {'id': 'clear_queue', 'text': 'Clear Queue', 'x': -2, 'y': -7, 'type': 'error', 'width': 2.0, 'height': 1.0},
    {'id': 'escalate', 'text': 'Escalate<br>Level', 'x': -2, 'y': -10, 'type': 'error', 'width': 2.0, 'height': 1.0},
    {'id': 'req_new_plan', 'text': 'Request<br>New Plan', 'x': -2, 'y': -13, 'type': 'processing', 'width': 2.0, 'height': 1.0},
    {'id': 'success_result', 'text': 'Return TaskResult<br>Object', 'x': 10, 'y': -13, 'type': 'success', 'width': 2.4, 'height': 1.0},
    {'id': 'failure_result', 'text': 'Return Failure<br>TaskResult', 'x': 14, 'y': 2, 'type': 'error', 'width': 2.4, 'height': 1.0}
]

# Create nodes with better sizing and shapes
for node in nodes:
    color = colors[node['type']]
    width = node['width']
    height = node['height']
    
    if node['type'] == 'decision':
        # Create diamond shape for decisions
        diamond_x = [node['x'] - width/2, node['x'], node['x'] + width/2, node['x'], node['x'] - width/2]
        diamond_y = [node['y'], node['y'] + height/2, node['y'], node['y'] - height/2, node['y']]
        
        fig.add_shape(
            type="path",
            path=f"M {diamond_x[0]} {diamond_y[0]} L {diamond_x[1]} {diamond_y[1]} L {diamond_x[2]} {diamond_y[2]} L {diamond_x[3]} {diamond_y[3]} Z",
            fillcolor=color,
            line=dict(color="black", width=2),
            opacity=0.9
        )
    else:
        # Rectangle for other nodes
        fig.add_shape(
            type="rect",
            x0=node['x'] - width/2, y0=node['y'] - height/2,
            x1=node['x'] + width/2, y1=node['y'] + height/2,
            fillcolor=color,
            line=dict(color="black", width=2),
            opacity=0.9
        )
    
    # Add text with better formatting
    text_color = "white" if node['type'] != 'decision' else "black"
    fig.add_annotation(
        x=node['x'], y=node['y'],
        text=node['text'],
        showarrow=False,
        font=dict(color=text_color, size=12, family="Arial Black"),
        align="center",
        bgcolor="rgba(255,255,255,0)" if node['type'] == 'decision' else "rgba(0,0,0,0)"
    )

# Define connections with better routing
connections = [
    ('start', 'init_check'),
    ('init_check', 'initialize', 'No', -2, 0),
    ('init_check', 'queue_check', 'Yes', 1, 0),
    ('initialize', 'queue_check'),
    ('queue_check', 'new_plan', 'Yes', 2, 0),
    ('queue_check', 'next_task', 'No', 1, 0),
    ('new_plan', 'next_task'),
    ('next_task', 'fallback_start'),
    ('fallback_start', 'n2_exec'),
    ('n2_exec', 'n2_check'),
    ('n2_check', 'execute', 'Yes', 0, -1.5),
    ('n2_check', 'n3_exec', 'No', 2, 1.5),
    ('n3_exec', 'n3_check'),
    ('n3_check', 'execute', 'Yes', -2, -1.5),
    ('n3_check', 'n4_exec', 'No', 2, 1.5),
    ('n4_exec', 'n4_check'),
    ('n4_check', 'execute', 'Yes', -4, -1.5),
    ('n4_check', 'n5_giveup', 'No', 2, 1.5),
    ('execute', 'log_result'),
    ('log_result', 'exec_check'),
    ('exec_check', 'more_tasks', 'Yes', 2, -1.5),
    ('exec_check', 'clear_queue', 'No', -2, 0),
    ('more_tasks', 'next_task', 'Yes', 0, 10.5),
    ('more_tasks', 'task_complete', 'No', 2, 0),
    ('clear_queue', 'escalate'),
    ('escalate', 'req_new_plan'),
    ('req_new_plan', 'next_task'),
    ('task_complete', 'success_result'),
    ('n5_giveup', 'failure_result')
]

# Create node lookup
node_lookup = {node['id']: node for node in nodes}

# Add arrows with better positioning
for i, conn in enumerate(connections):
    start_node = node_lookup[conn[0]]
    end_node = node_lookup[conn[1]]
    
    # Calculate arrow positions
    start_x, start_y = start_node['x'], start_node['y']
    end_x, end_y = end_node['x'], end_node['y']
    
    # Add arrow
    fig.add_annotation(
        x=end_x, y=end_y,
        ax=start_x, ay=start_y,
        xref="x", yref="y",
        axref="x", ayref="y",
        showarrow=True,
        arrowhead=2,
        arrowsize=1.5,
        arrowwidth=3,
        arrowcolor="black"
    )
    
    # Add label if provided with better positioning
    if len(conn) > 2:
        label_offset_x = conn[3] if len(conn) > 3 else 0
        label_offset_y = conn[4] if len(conn) > 4 else 0
        
        mid_x = (start_x + end_x) / 2 + label_offset_x * 0.3
        mid_y = (start_y + end_y) / 2 + label_offset_y * 0.3
        
        fig.add_annotation(
            x=mid_x, y=mid_y,
            text=conn[2],
            showarrow=False,
            font=dict(size=11, color="black", family="Arial Bold"),
            bgcolor="white",
            bordercolor="black",
            borderwidth=1,
            borderpad=3
        )

# Update layout with better sizing
fig.update_layout(
    title="Framework Task Execution Flow",
    showlegend=False,
    xaxis=dict(visible=False, range=[-5, 17]),
    yaxis=dict(visible=False, range=[-16, 22]),
    plot_bgcolor="white",
    paper_bgcolor="white",
    width=1200,
    height=1000
)

# Save the chart
fig.write_image("framework_task_execution.png")
fig.write_image("framework_task_execution.svg", format="svg")

print("Improved flowchart created successfully!")