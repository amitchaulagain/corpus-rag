// OpenAPI 3.0 specification for the Job Application Assistant API (JWT Auth)

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Job Application Assistant API",
    description: "API for AI-powered job application tools with JWT authentication.",
    version: "2.0.0",
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
      BearerAuth: []
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token. Get it from `/auth/signup`, `/auth/login`, or `/auth/token` (service accounts). Format: `Bearer eyJhbGc...`"
      }
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object" },
          error: { type: "string", nullable: true }
        },
        required: ["success"]
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: { type: "string" }
        }
      }
    }
  },
  paths: {
    "/auth/refresh": {
      post: {
        summary: "Refresh access token",
        description: "Get a new access token using a refresh token (automatic rotation)",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  refreshToken: { type: "string", description: "JWT refresh token" }
                },
                required: ["refreshToken"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Token refreshed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    accessToken: { type: "string" },
                    refreshToken: { type: "string", description: "New refresh token (rotation)" },
                    expiresIn: { type: "integer" }
                  }
                }
              }
            }
          },
          "401": { $ref: "#/components/schemas/Error" }
        }
      }
    },
    "/auth/token": {
      post: {
        summary: "Get service account token",
        description: "OAuth 2.0 Client Credentials flow for service accounts",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  grant_type: { type: "string", enum: ["client_credentials"] },
                  client_id: { type: "string", description: "Service account client ID" },
                  client_secret: { type: "string", description: "Service account secret" }
                },
                required: ["grant_type", "client_id", "client_secret"]
              },
              example: {
                grant_type: "client_credentials",
                client_id: "sa_1a2b3c4d5e6f7g8h",
                client_secret: "sas_9i8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Token generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: { type: "string" },
                    token_type: { type: "string", enum: ["Bearer"] },
                    expires_in: { type: "integer" },
                    scope: { type: "string" }
                  }
                }
              }
            }
          },
          "401": { $ref: "#/components/schemas/Error" }
        }
      }
    },
    "/auth/me": {
      get: {
        summary: "Get current user information",
        description: "Returns information about the authenticated user from JWT token",
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
                                type: { type: "string", enum: ["user", "service"] },
                                userType: { type: "string" },
                                scopes: { type: "array", items: { type: "string" } }
                              }
                            },
                            token: {
                              type: "object",
                              properties: {
                                type: { type: "string", enum: ["access", "service"] },
                                expiresAt: { type: "string", format: "date-time" }
                              }
                            },
                            rateLimit: {
                              type: "object",
                              properties: {
                                remaining: { type: "integer" },
                                resetTime: { type: "string", format: "date-time" }
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
          "401": { $ref: "#/components/schemas/Error" }
        }
      }
    },
    "/service-accounts": {
      get: {
        summary: "List service accounts",
        description: "List all service accounts (admin sees all, users see their own)",
        tags: ["Service Accounts"],
        responses: {
          "200": {
            description: "Service accounts retrieved",
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
                            serviceAccounts: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  name: { type: "string" },
                                  clientId: { type: "string" },
                                  scopes: { type: "array", items: { type: "string" } },
                                  isActive: { type: "boolean" },
                                  createdAt: { type: "string", format: "date-time" },
                                  lastUsedAt: { type: "string", format: "date-time" },
                                  rateLimit: {
                                    type: "object",
                                    properties: {
                                      requestsPerHour: { type: "integer" },
                                      requestsPerDay: { type: "integer" }
                                    }
                                  }
                                }
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
      },
      post: {
        summary: "Create service account",
        description: "Create a new service account for machine-to-machine authentication",
        tags: ["Service Accounts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Service account name" },
                  scopes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Permissions: cover_letter, resume, questionAndAnswers, upload, jobs, admin"
                  },
                  rateLimit: {
                    type: "object",
                    properties: {
                      requestsPerHour: { type: "integer", default: 5000 },
                      requestsPerDay: { type: "integer", default: 50000 }
                    }
                  }
                },
                required: ["name", "scopes"]
              },
              example: {
                name: "Job Application Bot",
                scopes: ["cover_letter", "resume", "questionAndAnswers"],
                rateLimit: {
                  requestsPerHour: 5000,
                  requestsPerDay: 50000
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Service account created (SAVE THE SECRET!)",
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
                            serviceAccount: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                clientId: { type: "string" },
                                clientSecret: { type: "string", description: "⚠️ SAVE THIS - shown only once!" },
                                scopes: { type: "array", items: { type: "string" } },
                                rateLimit: { type: "object" }
                              }
                            },
                            warning: { type: "string" }
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
      delete: {
        summary: "Revoke service account",
        description: "Revoke a service account (disables all tokens)",
        tags: ["Service Accounts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accountId: { type: "string" }
                },
                required: ["accountId"]
              },
              example: {
                accountId: "674f8a1b2c3d4e5f6a7b8c9d"
              }
            }
          }
        },
        responses: {
          "200": { $ref: "#/components/schemas/ApiResponse" },
          "404": { $ref: "#/components/schemas/Error" }
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
                  job_id: { type: "string", description: "Unique identifier for the job" },
                  job_details: { type: "object", description: "Full job description object or text" },
                  resume_text: { type: "string", description: "The user's full resume text" },
                  useAi: { type: "string", description: "The AI provider to use (e.g., 'gemini-pro')" },
                  prompt: { type: "string", description: "Optional custom prompt to override the default" },
                  job_title: { type: "string", description: "Job title" },
                  company: { type: "string", description: "Company name" }
                },
                required: ["job_id", "job_details", "resume_text", "useAi"]
              },
              example: {
                job_id: "cl_12345",
                useAi: "deepseek-chat",
                job_title: "Senior Full Stack Developer",
                company: "TechStart Inc",
                job_details: {
                  "title": "Senior Full Stack Developer",
                  "company": "TechStart Inc",
                  "location": "Remote",
                  "description": "We are seeking a Senior Full Stack Developer to join our growing team. The ideal candidate will have 5+ years of experience with React, Node.js, and cloud technologies. You'll work on building scalable web applications and collaborate with cross-functional teams. Requirements: Strong proficiency in JavaScript/TypeScript, experience with AWS or GCP, knowledge of CI/CD pipelines, excellent problem-solving skills."
                },
                resume_text: "John Doe\nSenior Software Engineer\n\nEXPERIENCE\nSoftware Engineer at Tech Corp (2019-2024)\n- Built and maintained React applications serving 1M+ users\n- Implemented microservices architecture using Node.js and Docker\n- Deployed applications on AWS using Terraform and GitHub Actions\n- Mentored 5 junior developers and led code reviews\n\nSKILLS\nJavaScript, TypeScript, React, Node.js, AWS, Docker, PostgreSQL, MongoDB, Git, CI/CD"
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
                    cover_letter: { type: "string" },
                    job_id: { type: "string" }
                  }
                }
              }
            }
          },
          "400": { $ref: "#/components/schemas/Error" }
        }
      }
    },
    "/resume": {
      post: {
        summary: "Enhance resume",
        description: "Enhance and optimize resume content for a specific job",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  job_id: { type: "string", description: "Unique identifier for the job" },
                  job_details: { type: "object", description: "Full job description object or text" },
                  resume_text: { type: "string", description: "The user's full resume text to be enhanced" },
                  useAi: { type: "string", description: "The AI provider to use" },
                  prompt: { type: "string", description: "Optional custom prompt" }
                },
                required: ["job_id", "job_details", "resume_text", "useAi"]
              },
              example: {
                job_id: "res_54321",
                useAi: "deepseek-chat",
                job_details: {
                  "title": "Frontend Engineer",
                  "description": "Looking for a Frontend Engineer with React expertise to build modern web applications. Must have experience with TypeScript, state management, and testing."
                },
                resume_text: "Jane Smith\nSoftware Developer\n\nWork History:\n- Worked at Acme Corp for 3 years doing web development\n- Made websites with React\n- Fixed bugs and added features\n\nSkills: JavaScript, HTML, CSS, React, Git"
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
                    resume: { type: "string" },
                    job_id: { type: "string" }
                  }
                }
              }
            }
          },
          "400": { $ref: "#/components/schemas/Error" }
        }
      }
    },
    "/questionAndAnswers": {
      post: {
        summary: "Generate Q&A responses",
        description: "Generate answers to employer questions based on resume and job context",
        tags: ["AI Generation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  job_id: { type: "string", description: "Unique identifier for the job" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } }
                      },
                      required: ["question"]
                    },
                    description: "Array of employer questions with options"
                  },
                  resume_text: { type: "string", description: "The user's full resume text" },
                  useAi: { type: "string", description: "The AI provider to use" },
                  job_details: { type: "object", description: "Optional job description for context" },
                  prompt: { type: "string", description: "Optional custom prompt" }
                },
                required: ["job_id", "questions", "resume_text", "useAi"]
              },
              example: {
                job_id: "qa_98765",
                useAi: "deepseek-chat",
                questions: [
                  {
                    question: "Why do you want to work for our company?",
                    options: ["I'm passionate about your mission", "The salary is competitive", "It's close to my house"]
                  },
                  {
                    question: "What is your greatest professional achievement?",
                    options: []
                  }
                ],
                resume_text: "Sarah Johnson\nProduct Manager\n\nEXPERIENCE\nSenior Product Manager at CloudTech (2020-2024)\n- Led development of SaaS platform that grew to $5M ARR\n- Managed cross-functional team of 12 engineers and designers\n- Launched 3 major features resulting in 40% user growth\n\nSKILLS\nProduct Strategy, Agile/Scrum, Data Analysis, Stakeholder Management, Roadmapping",
                job_details: {
                  "title": "Product Manager",
                  "description": "Seeking a Product Manager to lead our mobile app initiative. You'll define product vision, prioritize features, and work closely with engineering and design teams."
                }
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
                    answers: { type: "string" },
                    job_id: { type: "string" },
                    questions_count: { type: "integer" }
                  }
                }
              }
            }
          },
          "400": { $ref: "#/components/schemas/Error" }
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
              },
              example: {
                prompt: "Write a professional summary for a software engineer with 5 years of experience specializing in cloud infrastructure and DevOps.",
                context: "The candidate has worked at both startups and large companies, led migration to Kubernetes, and has AWS certifications.",
                model: "claude-3",
                temperature: 0.7,
                maxTokens: 500
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
    "/jobs": {
      get: {
        summary: "List jobs",
        description: "Get list of uploaded job descriptions",
        tags: ["Jobs"],
        responses: {
          "200": {
            description: "Jobs retrieved successfully"
          }
        }
      }
    }
  },
  tags: [
    {
      name: "Authentication",
      description: "JWT authentication - login, refresh, service accounts"
    },
    {
      name: "Service Accounts",
      description: "Manage service accounts for machine-to-machine auth"
    },
    {
      name: "AI Generation",
      description: "AI-powered content generation (cover letters, resume, Q&A)"
    },
    {
      name: "Jobs",
      description: "Job description management"
    }
  ]
};
