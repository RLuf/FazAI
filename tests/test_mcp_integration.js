// Test script for MCP integration with context7.com
const vscode = require('vscode');

async function testMCPIntegration() {
    try {
        // Test MCP provider configuration
        const config = vscode.workspace.getConfiguration('mcp');
        const provider = config.get('defaultProvider');
        const contextSize = config.get('contextWindowSize');
        
        console.log(`MCP Provider: ${provider}`);
        console.log(`Context Window Size: ${contextSize} tokens`);
        
        // Test document retrieval
        if (config.get('enableDocumentRetrieval')) {
            console.log('Document retrieval is enabled');
            // Add document retrieval test here
        }
        
        // Test semantic search
        if (config.get('enableSemanticSearch')) {
            console.log('Semantic search is enabled');
            // Add semantic search test here
        }
        
        return {
            success: true,
            provider,
            contextSize,
            features: {
                documentRetrieval: config.get('enableDocumentRetrieval'),
                semanticSearch: config.get('enableSemanticSearch')
            }
        };
    } catch (error) {
        console.error('Error testing MCP integration:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
module.exports = testMCPIntegration();
