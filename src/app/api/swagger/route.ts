import { NextResponse } from 'next/server';
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AlfaAutoGroup API',
      version: '1.0.0',
      description: 'API for AI agents and external integrations to operate the WhatsApp AutoGroup platform.',
    },
    servers: [
      {
        url: '/',
        description: 'Current environment'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Use a token here (e.g. your configured AI_API_KEY from environment variables).',
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ['src/app/api/**/*.ts'], // Scan all API routes for swagger annotations
};

export async function GET() {
  const swaggerSpec = swaggerJsdoc(options);
  return NextResponse.json(swaggerSpec);
}
