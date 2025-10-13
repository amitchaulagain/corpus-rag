// OpenAPI 3.0 specification for the Job Application Assistant API

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Job Application Assistant API",
    description: "API for AI-powered job application tools including cover letter generation, resume enhancement, and Q&A",
    version: "1.0.0",
    contact: {
      name: "Support",
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
    },
    "/cover_letter": {
      post: {
        summary: "Generate cover letter",
        description: "Generate a cover letter based on job description and resume",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jobDescription: { type: "string", description: "Job description text" },
                  resume: { type: "string", description: "Resume text" },
                  companyName: { type: "string" },
                  jobTitle: { type: "string" },
                  temperature: { type: "number", default: 0.7 }
                },
                required: ["jobDescription", "resume"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Cover letter generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    coverLetter: { type: "string" },
                    metadata: {
                      type: "object",
                      properties: {
                        model: { type: "string" },
                        tokensUsed: { type: "integer" },
                        processingTime: { type: "integer" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/resume": {
      post: {
        summary: "Enhance resume",
        description: "Enhance and optimize resume content",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  resume: { type: "string", description: "Resume text to enhance" },
                  jobDescription: { type: "string", description: "Optional job description for tailoring" },
                  temperature: { type: "number", default: 0.7 }
                },
                required: ["resume"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Resume enhanced successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    enhancedResume: { type: "string" },
                    suggestions: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/questionAndAnswers": {
      post: {
        summary: "Generate Q&A responses",
        description: "Generate answers to employer questions based on resume",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of employer questions"
                  },
                  resume: { type: "string", description: "Resume text for context" },
                  jobDescription: { type: "string", description: "Job description for context" }
                },
                required: ["questions", "resume"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Answers generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    answers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string" },
                          answer: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/generate": {
      post: {
        summary: "Generic AI generation",
        description: "Generate content using AI with custom prompts",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "AI prompt" },
                  context: { type: "string", description: "Additional context" },
                  model: { type: "string", description: "AI model to use" },
                  temperature: { type: "number", default: 0.7 },
                  maxTokens: { type: "integer" }
                },
                required: ["prompt"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Content generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    result: { type: "string" },
                    metadata: { type: "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/upload": {
      get: {
        summary: "List or get user files",
        description: "List all files for a user, or get content of a specific file. Files are stored in ./data/uploads/{userId}/ on the server.",
        tags: ["Files"],
        parameters: [
          {
            name: "userId",
            in: "query",
            required: true,
            description: "User ID to list files for",
            schema: { type: "string" }
          },
          {
            name: "filename",
            in: "query",
            required: false,
            description: "Optional: specific filename to get content (supports .txt and .pdf)",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Files listed or file content retrieved",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      description: "List of files",
                      properties: {
                        success: { type: "boolean" },
                        files: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              type: { type: "string", enum: ["txt", "pdf"] }
                            }
                          }
                        }
                      }
                    },
                    {
                      type: "object",
                      description: "File content",
                      properties: {
                        success: { type: "boolean" },
                        filename: { type: "string" },
                        content: { type: "string", description: "Text content (extracted from PDF if applicable)" }
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
        summary: "Upload file",
        description: "Upload a .txt or .pdf file. Files are stored in ./data/uploads/{userId}/ folder on the server for later retrieval.",
        tags: ["Files"],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "File to upload (.txt or .pdf only)"
                  },
                  userId: {
                    type: "string",
                    description: "User ID - files will be stored in ./data/uploads/{userId}/"
                  }
                },
                required: ["file", "userId"]
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
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    filename: { type: "string" },
                    path: { type: "string", description: "Server path where file is stored" },
                    content: { type: "string", description: "Text content (only for .txt files)" }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request (missing file/userId or unsupported file type)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", enum: [false] },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      },
      delete: {
        summary: "Delete a file",
        description: "Delete a specific file from the user's folder",
        tags: ["Files"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  filename: { type: "string" }
                },
                required: ["userId", "filename"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "File deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/jobs": {
      get: {
        summary: "List jobs",
        description: "Get list of uploaded job descriptions",
        tags: ["Jobs"],
        responses: {
          "200": {
            description: "Jobs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    jobs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          filename: { type: "string" },
                          company: { type: "string" },
                          title: { type: "string" },
                          uploadedAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/jobs/{filename}": {
      get: {
        summary: "Get job details",
        description: "Get details of a specific job description",
        tags: ["Jobs"],
        parameters: [
          {
            name: "filename",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Job retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    job: {
                      type: "object",
                      properties: {
                        filename: { type: "string" },
                        content: { type: "string" },
                        company: { type: "string" },
                        title: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/auth/keys": {
      get: {
        summary: "List API keys",
        description: "List all API keys for the authenticated user (requires session token)",
        tags: ["Authentication"],
        security: [{ SessionAuth: [] }],
        responses: {
          "200": {
            description: "API keys retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        apiKeys: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              keyPrefix: { type: "string" },
                              scopes: { type: "array", items: { type: "string" } },
                              createdAt: { type: "string", format: "date-time" },
                              lastUsed: { type: "string", format: "date-time" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Generate API key",
        description: "Generate a new API key for programmatic access (requires session token)",
        tags: ["Authentication"],
        security: [{ SessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Name for the API key" },
                  scopes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Permissions for the API key"
                  }
                },
                required: ["name", "scopes"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "API key generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        apiKey: { type: "string", description: "Full API key (save this - won't be shown again!)" },
                        keyInfo: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            keyPrefix: { type: "string" },
                            scopes: { type: "array", items: { type: "string" } },
                            createdAt: { type: "string", format: "date-time" }
                          }
                        }
                      }
                    }
                  }
                }
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
      name: "AI Generation",
      description: "AI-powered content generation (cover letters, resume enhancement, Q&A)"
    },
    {
      name: "Files",
      description: "File upload, download, and management"
    },
    {
      name: "Jobs",
      description: "Job description management"
    },
    {
      name: "System",
      description: "System monitoring and statistics"
    }
  ]
};