import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "../core/logger.js";

/**
 * Hosts an MCP Client connected via an in-memory transport to our local MCP Server.
 * Orchestrator and LlmClient can use this Host to invoke local tools autonomously without needing stdio/HTTP transports.
 */
export class McpHost {
    private client: Client;
    private isConnected: boolean = false;
    private connectingPromise: Promise<void> | null = null;
    private transportClient: InMemoryTransport;

    constructor(server: Server) {
        // We use the inMemory transport pair to connect our host client directly to our local server
        // bypassing network or stdio overhead for purely local tools like internal MemoryStore.
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        // Wire up the server side instantly
        server.connect(serverTransport).catch(err => {
            logger.error(`[MCP] Internal Server connect failed: ${err}`);
        });

        this.transportClient = clientTransport;

        this.client = new Client({
            name: "aiunit71-mcp-host",
            version: "1.0.0",
        });
    }

    async connect(): Promise<void> {
        if (this.isConnected) return;
        if (this.connectingPromise) return this.connectingPromise;
        this.connectingPromise = (async () => {
            try {
                await this.client.connect(this.transportClient);
                this.isConnected = true;
                logger.info("[MCP] Host connected to internal MemoryServer");
            } catch (err) {
                logger.error(`[MCP] Host failed to connect: ${err}`);
                this.connectingPromise = null;
                throw err;
            }
        })();
        return this.connectingPromise;
    }

    /**
     * Proxies a tool call to the connected MCP server.
     */
    async callTool(name: string, args: Record<string, unknown>): Promise<string> {
        if (!this.isConnected) {
            await this.connect();
        }

        logger.debug(`[MCP] Host calling tool: ${name}`);
        const result = await this.client.callTool({
            name,
            arguments: args,
        });

        if (result.isError) {
            const errorText = (result.content as Array<any>).map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join(' ');
            logger.error(`[MCP] Tool call ${name} returned error: ${errorText}`);
            throw new Error(errorText);
        }

        return (result.content as Array<any>).map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join("\n");
    }

    /**
     * Fetches the definitions of all available tools to pass into an LLM context.
     */
    async getAvailableTools() {
        if (!this.isConnected) {
            await this.connect();
        }
        const tools = await this.client.listTools();
        return tools.tools;
    }
}
