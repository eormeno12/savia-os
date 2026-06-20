export async function POST(req: Request) {
  const body = await req.json();
  await fetch(`${process.env.DEMO_API_URL}/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  return new Response(null, { status: 204 });
}
