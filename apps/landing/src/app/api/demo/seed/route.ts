export async function POST(req: Request) {
  const body = await req.json();
  const upstream = await fetch(`${process.env.DEMO_API_URL}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return Response.json(await upstream.json(), { status: upstream.status });
}
