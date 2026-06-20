import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type GraphNode = { id: string; name: string; type: string };
type GraphLink = { source: string; target: string; label: string };

const EXTRACT_PROMPT = `Eres un extractor de grafos de conocimiento. Dado un conjunto de memorias de un usuario, extrae todas las entidades y relaciones.

Tipos de entidad válidos: Person, Company, Role, Tool, Product, Topic, Project, Location, Skill

Devuelve SOLO un JSON con este formato exacto:
{
  "nodes": [{"id": "slug-unico", "name": "Nombre legible", "type": "TipoEntidad"}],
  "links": [{"source": "id-origen", "target": "id-destino", "label": "relacion en minusculas"}]
}

Reglas:
- El id debe ser un slug único en minúsculas sin espacios (ej: "camila-avila", "yape", "product-manager")
- No dupliques nodos
- Las relaciones deben ser verbos simples (trabaja_en, usa, lidera, estudia, conoce)
- Incluye al menos el nodo principal (la persona) y sus conexiones directas`;

async function getMemoriesFromQdrant(userId: string): Promise<string[]> {
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const res = await fetch(`${qdrantUrl}/collections/openmemory/points/scroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      limit: 100,
      with_payload: true,
      filter: { must: [{ key: 'user_id', match: { value: userId } }] },
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { result?: { points?: { payload?: { data?: string } }[] } };
  return (data.result?.points ?? []).map((p) => p.payload?.data ?? '').filter(Boolean);
}

export async function getMemoryGraph(userId: string): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  if (!userId) return { nodes: [], links: [] };

  const memories = await getMemoriesFromQdrant(userId);
  if (memories.length === 0) return { nodes: [], links: [] };

  if (memories.length === 0) return { nodes: [], links: [] };

  const memoriesText = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: `Memorias del usuario:\n${memoriesText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const content = res.choices[0].message.content ?? '{}';
    const graph = JSON.parse(content) as { nodes?: GraphNode[]; links?: GraphLink[] };

    return {
      nodes: graph.nodes ?? [],
      links: graph.links ?? [],
    };
  } catch {
    return { nodes: [], links: [] };
  }
}
