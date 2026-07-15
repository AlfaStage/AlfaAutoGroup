import { getServerSession } from "next-auth/next"

export async function isAuthenticated(request: Request) {
  const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
  
  console.log("--- AUTH DEBUG ---");
  console.log("Token recebido:", aiToken);
  console.log("Token esperado (env):", process.env.AI_API_KEY);
  console.log("Tamanho recebido:", aiToken?.length);
  console.log("Tamanho esperado:", process.env.AI_API_KEY?.length);

  if (aiToken && aiToken === process.env.AI_API_KEY) return true;
  
  const session = await getServerSession();
  if (session) return true;
  
  return false;
}
