'use client';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import AppShell from '@/components/AppShell';

// SwaggerUI is not SSR compatible, so we load it dynamically
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocs() {
  return (
    <AppShell
      titulo="Referência da API (Swagger)"
      subtitulo="Especificação OpenAPI e testes interativos de endpoints"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 overflow-hidden border border-border/40 shadow-sm">
        <SwaggerUI url="/api/swagger" />
      </div>
    </AppShell>
  );
}
