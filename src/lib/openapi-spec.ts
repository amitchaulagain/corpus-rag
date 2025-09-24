// OpenAPI 3.0 specification for the RAG System API

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "RAG System API",
    description: "API for managing files, corpus, and querying the RAG system",
    version: "1.0.0",
    contact: {
      name: "RAG System Support",
      email: "support@example.com"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      url: "/api",
      description: "Current server"
    }
  ],
  security: [
    {
      ApiKeyAuth: []
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "API Key authentication. Format: `Bearer rag_[keyId]_[secret]`"
      }
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object" },
          error: { type: "string", nullable: true },
          timestamp: { type: "string", format: "date-time" },
          requestId: { type: "string" }
        },
        required: ["success", "timestamp"]
      },
      FileInfo: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          size: { type: "integer" },
          mimeType: { type: "string" },
          userId: { type: "string" },
          fileId: { type: "string" },
          fullPath: { type: "string" },
          created: { type: "string", format: "date-time" },
          updated: { type: "string", format: "date-time", nullable: true }
        }
      },
      CorpusInfo: {
        type: "object",
        properties: {
          corpusId: { type: "string" },
          userId: { type: "string" },
          displayName: { type: "string" },
          exists: { type: "boolean" },
          createTime: { type: "string", format: "date-time" },
          fileCount: { type: "integer" }
        }
      },
      QueryRequest: {
        type: "object",
        properties: {
          userId: { type: "string" },
          question: { type: "string" },
          context: { type: "string", nullable: true },
          maxResults: { type: "integer", default: 5 }
        },
        required: ["userId", "question"]
      },
      QueryResponse: {
        type: "object",
        properties: {
          answer: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
          processingTime: { type: "integer" },
          corpusId: { type: "string" }
        }
      },
      ImportRequest: {
        type: "object",
        properties: {
          userId: { type: "string" },
          cloudStorageUris: { type: "array", items: { type: "string" } },
          waitForCompletion: { type: "boolean", default: false }
        },
        required: ["userId", "cloudStorageUris"]
      },
      SystemStatus: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["healthy", "degraded", "down"] },
          version: { type: "string" },
          uptime: { type: "integer" },
          responseTime: { type: "integer" },
          services: {
            type: "object",
            properties: {
              storage: { type: "string", enum: ["healthy", "degraded", "down"] },
              vertexAI: { type: "string", enum: ["healthy", "degraded", "down"] },
              database: { type: "string", enum: ["healthy", "degraded", "down"] }
            }
          }
        }
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          requestId: { type: "string" }
        }
      }
    }
  },
  paths: {
    "/auth/me": {
      get: {
        summary: "Get current user information",
        description: "Returns information about the authenticated user and their API key",
        tags: ["Authentication"],
        responses: {
          "200": {
            description: "User information retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            user: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                email: { type: "string" },
                                scopes: { type: "array", items: { type: "string" } }
                              }
                            },
                            apiKey: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                scopes: { type: "array", items: { type: "string" } },
                                lastUsed: { type: "string", format: "date-time" }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" }
              }
            }
          }
        }
      }
    },
    "/files": {
      get: {
        summary: "List user files",
        description: "Get a list of all files for a user",
        tags: ["Files"],
        parameters: [
          {
            name: "userId",
            in: "query",
            description: "User ID to list files for",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Files retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            files: { type: "array", items: { $ref: "#/components/schemas/FileInfo" } },
                            count: { type: "integer" }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Upload a file",
        description: "Upload a file for a user and automatically import to RAG",
        tags: ["Files"],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  userId: { type: "string" },
                  replaceExisting: { type: "boolean", default: false }
                },
                required: ["file"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "File uploaded successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            file: { $ref: "#/components/schemas/FileInfo" },
                            ragImport: {
                              type: "object",
                              properties: {
                                success: { type: "boolean" },
                                operationId: { type: "string" },
                                error: { type: "string", nullable: true }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/files/{filename}": {
      get: {
        summary: "Get file information",
        description: "Get detailed information about a specific file",
        tags: ["Files"],
        parameters: [
          {
            name: "filename",
            in: "path",
            required: true,
            description: "Name of the file",
            schema: { type: "string" }
          },
          {
            name: "userId",
            in: "query",
            description: "User ID who owns the file",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "File information retrieved",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/FileInfo" }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            description: "File not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" }
              }
            }
          }
        }
      },
      delete: {
        summary: "Delete a file",
        description: "Delete a specific file",
        tags: ["Files"],
        parameters: [
          {
            name: "filename",
            in: "path",
            required: true,
            description: "Name of the file to delete",
            schema: { type: "string" }
          },
          {
            name: "userId",
            in: "query",
            description: "User ID who owns the file",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "File deleted successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            deleted: { type: "boolean" },
                            filename: { type: "string" }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/corpus": {
      get: {
        summary: "Get user corpus",
        description: "Get information about a user's corpus including files",
        tags: ["Corpus"],
        parameters: [
          {
            name: "userId",
            in: "query",
            description: "User ID to get corpus for",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Corpus information retrieved",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/CorpusInfo" }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Manage corpus",
        description: "Create or manage a user's corpus",
        tags: ["Corpus"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  action: { type: "string", enum: ["get_or_create", "cleanup"], default: "get_or_create" }
                },
                required: ["userId"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Corpus operation completed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" }
              }
            }
          }
        }
      }
    },
    "/rag/query": {
      post: {
        summary: "Query the RAG system",
        description: "Ask a question about the user's documents",
        tags: ["RAG"],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QueryRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Query completed successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/QueryResponse" }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/rag/import": {
      post: {
        summary: "Import files to RAG",
        description: "Import files from cloud storage into the RAG system",
        tags: ["RAG"],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Import started successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            message: { type: "string" },
                            operationId: { type: "string" },
                            filesCount: { type: "integer" },
                            corpusId: { type: "string" }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/rag/operations/{operationId}": {
      get: {
        summary: "Check operation status",
        description: "Check the status of a RAG import operation",
        tags: ["RAG"],
        parameters: [
          {
            name: "operationId",
            in: "path",
            required: true,
            description: "Operation ID to check",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Operation status retrieved",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            operationId: { type: "string" },
                            done: { type: "boolean" },
                            progress: { type: "integer" },
                            error: { type: "string", nullable: true },
                            result: { type: "object" }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/system/status": {
      get: {
        summary: "System health check",
        description: "Get system health and status information",
        tags: ["System"],
        security: [],
        responses: {
          "200": {
            description: "System status retrieved",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/SystemStatus" }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/system/stats": {
      get: {
        summary: "Usage statistics",
        description: "Get usage statistics for a user",
        tags: ["System"],
        parameters: [
          {
            name: "userId",
            in: "query",
            description: "User ID to get stats for",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Usage statistics retrieved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: "Authentication",
      description: "API key management and user authentication"
    },
    {
      name: "Files",
      description: "File upload, download, and management"
    },
    {
      name: "Corpus",
      description: "Corpus creation and management"
    },
    {
      name: "RAG",
      description: "RAG system queries and document import"
    },
    {
      name: "System",
      description: "System monitoring and statistics"
    }
  ]
};