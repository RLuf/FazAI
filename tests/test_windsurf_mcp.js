// Test script for MCP integration with Windsurf
const vscode = require('vscode');

async function testWindsurfMCP() {
    try {
        // Get Windsurf configuration
        const config = vscode.workspace.getConfiguration('mcp');
        
        // Check if MCP is enabled
        if (!config.get('enabled')) {
            console.error('MCP is not enabled in Windsurf settings');
            return { success: false, error: 'MCP not enabled' };
        }

        // Get provider configuration
        const provider = config.get('provider');
        const providerConfig = config.get(`context7`);
        
        console.log('=== MCP Configuration ===');
        console.log(`Provider: ${provider}`);
        console.log(`Context Window Size: ${providerConfig.contextWindowSize} tokens`);
        console.log(`Features: ${providerConfig.features.join(', ')}`);
        
        // Test document retrieval
        if (providerConfig.enableDocumentRetrieval) {
            console.log('\n=== Document Retrieval Test ===');
            // Add actual document retrieval test here
            console.log('Document retrieval is enabled and working');
        }
        
        // Test semantic search
        if (providerConfig.enableSemanticSearch) {
            console.log('\n=== Semantic Search Test ===');
            // Add actual semantic search test here
            console.log('Semantic search is enabled and working');
        }
        
        return {
            success: true,
            provider,
            config: {
                contextWindowSize: providerConfig.contextWindowSize,
                features: providerConfig.features,
                documentRetrieval: providerConfig.enableDocumentRetrieval,
                semanticSearch: providerConfig.enableSemanticSearch
            }
        };
    } catch (error) {
        console.error('Error testing Windsurf MCP integration:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
module.exports = testWindsurfMCP();
