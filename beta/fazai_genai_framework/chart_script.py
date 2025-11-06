import plotly.graph_objects as go
import plotly.express as px

# Create a comprehensive architecture diagram using plotly
fig = go.Figure()

# Define node positions for proper layering
nodes = {
    # Framework Layer (top)
    'GenAIMiniFramework': (0.5, 0.9),
    
    # Manager Layer
    'MemoryManager': (0.15, 0.75),
    'CacheManager': (0.35, 0.75),
    'FallbackManager': (0.65, 0.75),
    'ClaudeIntegration': (0.85, 0.75),
    
    # Fallback Hierarchy
    'N2_Local': (0.6, 0.6),
    'N3_Team': (0.65, 0.5),
    'N4_Online': (0.7, 0.4),
    'Give_Up': (0.75, 0.3),
    
    # LLM Servers
    'Gerente_8000': (0.3, 0.45),
    'Analista_8001': (0.4, 0.45),
    'Programador_8002': (0.5, 0.45),
    
    # External Services
    'Google_GenAI': (0.85, 0.4),
    'Qdrant_DB': (0.15, 0.55),
    'GPTCache': (0.35, 0.55),
    'Claude_JSON': (0.85, 0.55),
    
    # Qdrant Collections
    'fz_memories': (0.05, 0.35),
    'fazai_logs': (0.15, 0.35),
    'fazai_person': (0.25, 0.35)
}

# Define colors for different layers
colors = {
    'framework': '#B3E5EC',  # Light cyan
    'manager': '#A5D6A7',    # Light green
    'fallback': '#E3F2FD',   # Light blue
    'server': '#FFCC80',     # Light orange
    'external': '#E1BEE7',   # Light purple
    'collection': '#F3E5F5'  # Very light purple
}

# Define node categories
node_categories = {
    'GenAIMiniFramework': 'framework',
    'MemoryManager': 'manager',
    'CacheManager': 'manager',
    'FallbackManager': 'manager',
    'ClaudeIntegration': 'manager',
    'N2_Local': 'fallback',
    'N3_Team': 'fallback',
    'N4_Online': 'fallback',
    'Give_Up': 'fallback',
    'Gerente_8000': 'server',
    'Analista_8001': 'server',
    'Programador_8002': 'server',
    'Google_GenAI': 'external',
    'Qdrant_DB': 'external',
    'GPTCache': 'external',
    'Claude_JSON': 'external',
    'fz_memories': 'collection',
    'fazai_logs': 'collection',
    'fazai_person': 'collection'
}

# Node labels with line breaks
node_labels = {
    'GenAIMiniFramework': 'GenAI Mini<br>Framework',
    'MemoryManager': 'Memory<br>Manager',
    'CacheManager': 'Cache<br>Manager',
    'FallbackManager': 'Fallback<br>Manager',
    'ClaudeIntegration': 'Claude<br>Integration',
    'N2_Local': 'N2: Local<br>+Memory',
    'N3_Team': 'N3: Team<br>Local',
    'N4_Online': 'N4: Online<br>Supervisor',
    'Give_Up': 'Give Up',
    'Gerente_8000': 'Gerente<br>:8000',
    'Analista_8001': 'Analista<br>:8001',
    'Programador_8002': 'Programador<br>:8002',
    'Google_GenAI': 'Google<br>GenAI',
    'Qdrant_DB': 'Qdrant<br>Database',
    'GPTCache': 'GPTCache',
    'Claude_JSON': 'Claude<br>JSON',
    'fz_memories': 'fz_memories',
    'fazai_logs': 'fazai_logs',
    'fazai_person': 'fazai_person'
}

# Add nodes
for node, (x, y) in nodes.items():
    category = node_categories[node]
    color = colors[category]
    
    fig.add_trace(go.Scatter(
        x=[x], y=[y],
        mode='markers+text',
        marker=dict(
            size=80,
            color=color,
            line=dict(width=2, color='black')
        ),
        text=node_labels[node],
        textposition='middle center',
        textfont=dict(size=10, color='black'),
        name=category.title(),
        showlegend=False,
        hovertemplate=f'{node_labels[node]}<extra></extra>'
    ))

# Define connections
connections = [
    # Framework to Managers
    ('GenAIMiniFramework', 'MemoryManager'),
    ('GenAIMiniFramework', 'CacheManager'),
    ('GenAIMiniFramework', 'FallbackManager'),
    ('GenAIMiniFramework', 'ClaudeIntegration'),
    
    # Fallback hierarchy
    ('FallbackManager', 'N2_Local'),
    ('N2_Local', 'N3_Team'),
    ('N3_Team', 'N4_Online'),
    ('N4_Online', 'Give_Up'),
    
    # Managers to external services
    ('MemoryManager', 'Qdrant_DB'),
    ('CacheManager', 'GPTCache'),
    ('ClaudeIntegration', 'Claude_JSON'),
    
    # LLM server connections
    ('N2_Local', 'Gerente_8000'),
    ('N2_Local', 'Analista_8001'),
    ('N2_Local', 'Programador_8002'),
    ('N3_Team', 'Gerente_8000'),
    ('N3_Team', 'Analista_8001'),
    ('N3_Team', 'Programador_8002'),
    ('N4_Online', 'Google_GenAI'),
    
    # Qdrant to collections
    ('Qdrant_DB', 'fz_memories'),
    ('Qdrant_DB', 'fazai_logs'),
    ('Qdrant_DB', 'fazai_person'),
    
    # Memory manager to collections
    ('MemoryManager', 'fz_memories'),
    ('MemoryManager', 'fazai_logs'),
    ('MemoryManager', 'fazai_person')
]

# Add connections as arrows
for source, target in connections:
    x0, y0 = nodes[source]
    x1, y1 = nodes[target]
    
    fig.add_annotation(
        x=x1, y=y1,
        ax=x0, ay=y0,
        xref='x', yref='y',
        axref='x', ayref='y',
        arrowhead=2,
        arrowsize=1,
        arrowwidth=1.5,
        arrowcolor='gray',
        showarrow=True
    )

# Add legend manually
legend_items = [
    ('Framework', colors['framework']),
    ('Managers', colors['manager']),
    ('Fallback', colors['fallback']),
    ('LLM Servers', colors['server']),
    ('External', colors['external']),
    ('Collections', colors['collection'])
]

for i, (label, color) in enumerate(legend_items):
    fig.add_trace(go.Scatter(
        x=[None], y=[None],
        mode='markers',
        marker=dict(size=15, color=color, line=dict(width=1, color='black')),
        name=label,
        showlegend=True
    ))

fig.update_layout(
    title='GenAI Mini Framework Architecture',
    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[-0.05, 1.05]),
    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[0.2, 1.0]),
    plot_bgcolor='white',
    legend=dict(
        orientation='h',
        yanchor='bottom',
        y=1.02,
        xanchor='center',
        x=0.5
    )
)

# Save the chart
fig.write_image('genai_architecture.png')
fig.write_image('genai_architecture.svg', format='svg')

print("Architecture diagram created successfully!")