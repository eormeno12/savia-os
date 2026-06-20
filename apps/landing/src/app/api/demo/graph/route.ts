export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? '';
  const upstream = await fetch(
    `${process.env.DEMO_API_URL}/graph?userId=${encodeURIComponent(userId)}`
  );
  return Response.json(await upstream.json());
}
