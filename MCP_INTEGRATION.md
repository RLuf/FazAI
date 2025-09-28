# MCP Integration with context7.com

This document outlines the MCP (Model Context Protocol) integration with context7.com to enable extended context capabilities in VS Code.

## Configuration

### VS Code Settings

The following settings have been configured in `settings.json`:

```json
"mcp.providers": {
    "context7": {
        "enabled": true,
        "apiKey": "ctx7sk-f5999612-afbb-4341-8377-8fbf83832ca9",
        "endpoint": "https://api.context7.com/v1/mcp",
        "contextWindow": 32000,
        "features": ["extended-context", "semantic-search", "document-retrieval"]
    }
},
"mcp.defaultProvider": "context7",
"mcp.autoExpandContext": true,
"mcp.contextWindowSize": 32000,
"mcp.enableDocumentRetrieval": true,
"mcp.enableSemanticSearch": true,
"mcp.maxDocumentSizeMB": 10
```

### Supported File Types

The following file types are configured for MCP processing:
- Text files (`.txt`, `.md`)
- Code files (`.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`)
- Configuration files (`.json`)

## Testing the Integration

A test script is available at `test_mcp_integration.js` to verify the MCP integration. Run it using:

```bash
node test_mcp_integration.js
```

## Troubleshooting

### Common Issues

1. **Schema Validation Warnings**
   - If you see warnings about MCP schema validation, they can be safely ignored
   - The schema is automatically managed by the MCP extension

2. **API Key Issues**
   - Ensure the API key is valid and has sufficient permissions
   - Check the context7.com dashboard for usage and limits

3. **Context Size Limitations**
   - The maximum context window is set to 32,000 tokens
   - Larger documents may be truncated or split automatically

## Security Considerations

- The API key is stored in your VS Code settings
- Ensure your `settings.json` file has appropriate permissions
- Rotate API keys regularly for enhanced security

## Reference

- [context7.com Documentation](https://context7.com/docs)
- [MCP Protocol Specification](https://mcp.dev/spec)
- [VS Code MCP Extension](https://marketplace.visualstudio.com/items?itemName=context7.mcp)
