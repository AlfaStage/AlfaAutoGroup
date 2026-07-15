import { getServerSession } from "next-auth/next"

export async function isAuthenticated(request: Request) {
  const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedKey = process.env.AI_API_KEY || "gdngfbgsefgrdthfyjgumh76543gdbhr6j7yht";
  
  console.log("--- AUTH DEBUG ---");
  console.log("Token recebido:", aiToken);
  console.log("Token esperado (env):", expectedKey);

  if (aiToken && aiToken === expectedKey) return true;
  
  const session = await getServerSession();
  if (session) return true;
  
  return false;
}
