import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MemoryStore } from "../memory/memory-store.js";
import { logger } from "../core/logger.js";

/**
 * Creates an MCP Server that exposes the AiUnit71 MemoryStore.
 * Allows agents (or external MCP clients) to store and retrieve context.
 */
export function createMemoryMcpServer(memoryStore: MemoryStore): Server {
    const server = new Server(
        {
            name: "aiunit71-memory-mcp",
            version: "1.0.0",
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Expose the available memory tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "memory_store",
                    description: "Store a new memory entry in the shared mission context. Use this to persist research findings, draft updates, or audience language patterns.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            roomId: {
                                type: "string",
                                description: "The ID of the current room (or 'shared' for global mission context)",
                            },
                            type: {
                                type: "string",
                                description: "The type of memory entry",
                                enum: ["experience", "decision", "error", "learning", "context"],
                                default: "context"
                            },
                            content: {
                                type: "string",
                                description: "The detailed content payload (markdown, JSON, or text) to store."
                            },
                        },
                        required: ["roomId", "content"],
                    },
                },
                {
                    name: "memory_retrieve",
                    description: "Retrieve memory context for the current room or shared mission. Returns formatted context.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            roomId: {
                                type: "string",
                                description: "The ID of the current room looking for context",
                            },
                            query: {
                                type: "string",
                                description: "Optional keyword search query to filter the memory by.",
                            },
                            maxEntries: {
                                type: "number",
                                description: "Maximum number of recent entries to return (default: 20)",
                                default: 20
                            }
                        },
                        required: ["roomId"],
                    },
                },
            ],
        };
    });

    // Handle execution of memory tools
    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
        const { name, arguments: args } = request.params;

        if (!args) {
            throw new Error(`Missing arguments for tool ${name}`);
        }

        if (name === "memory_store") {
            const roomId = String(args.roomId);
            const content = String(args.content);
            const type = (args.type as "experience" | "decision" | "error" | "learning" | "context") || "context";

            const entry = memoryStore.add(roomId, {
                roomId,
                type,
                content,
                metadata: { source: "mcp" },
            });

            logger.info(`[MCP] memory_store executed for room ${roomId}`);

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully stored memory entry with ID: ${entry.id}`,
                    },
                ],
            };
        }

        if (name === "memory_retrieve") {
            const roomId = String(args.roomId);
            const query = args.query ? String(args.query) : undefined;
            const maxEntries = typeof args.maxEntries === "number" ? args.maxEntries : 20;

            let resultText = "";

            if (query) {
                const matches = memoryStore.search(roomId, query);
                const limited = matches.slice(-maxEntries);

                if (limited.length === 0) {
                    resultText = `No memory entries found matching query: "${query}" in room: ${roomId}`;
                } else {
                    resultText = `Found ${limited.length} entries matching "${query}":\n\n` +
                        limited.map((e: any) => `[${e.type}] ${e.content}`).join("\n");
                }
            } else {
                resultText = memoryStore.getContextForAgent(roomId, maxEntries);
            }

            logger.info(`[MCP] memory_retrieve executed for room ${roomId} (query: ${query || "none"})`);

            return {
                content: [
                    {
                        type: "text",
                        text: resultText,
                    },
                ],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    });

    return server;
}
