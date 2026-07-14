'use client';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// SwaggerUI is not SSR compatible, so we load it dynamically
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocs() {
  return (
    <div className="h-screen w-full bg-white">
      <SwaggerUI url="/api/swagger" />
    </div>
  );
}
