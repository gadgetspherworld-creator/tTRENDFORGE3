import { prisma } from '@trendforge/database';
import { logger } from '@trendforge/logger';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── K-Means clustering (pure TS, no external ML lib needed) ─────────────────

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
}

function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const mag = magnitude(a) * magnitude(b);
  return mag === 0 ? 0 : dotProduct(a, b) / mag;
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((val, i) => val + (b[i] ?? 0));
}

function scaleVector(v: number[], scalar: number): number[] {
  return v.map(val => val / scalar);
}

function findNearestCentroid(embedding: number[], centroids: number[][]): number {
  let bestIdx = 0;
  let bestSim = -Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const sim = cosineSimilarity(embedding, centroids[i]!);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function kMeansIteration(
  embeddings: number[][],
  centroids: number[][]
): { assignments: number[]; newCentroids: number[][] } {
  const k = centroids.length;
  const assignments = embeddings.map(e => findNearestCentroid(e, centroids));

  // Recompute centroids
  const sums: number[][] = Array.from({ length: k }, () => new Array(embeddings[0]!.length).fill(0));
  const counts: number[] = new Array(k).fill(0);

  for (let i = 0; i < embeddings.length; i++) {
    const cluster = assignments[i]!;
    sums[cluster] = addVectors(sums[cluster]!, embeddings[i]!);
    counts[cluster]++;
  }

  const newCentroids = sums.map((sum, i) =>
    counts[i]! > 0 ? scaleVector(sum, counts[i]!) : centroids[i]!
  );

  return { assignments, newCentroids };
}

function kMeans(embeddings: number[][], k: number, maxIter = 20): { assignments: number[]; centroids: number[][] } {
  // Initialize centroids with k-means++ style (pick spread-out initial points)
  const shuffled = [...embeddings].sort(() => Math.random() - 0.5);
  let centroids = shuffled.slice(0, k);
  let assignments: number[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const result = kMeansIteration(embeddings, centroids);
    const changed = result.assignments.some((a, i) => a !== assignments[i]);
    assignments = result.assignments;
    centroids = result.newCentroids;
    if (!changed) break;
  }

  return { assignments, centroids };
}

// ─── Embedding generation ─────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // token limit guard
  });
  return response.data[0]!.embedding;
}

export async function embedProduct(productId: string): Promise<number[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, description: true, tags: true, categories: true },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  const text = [
    product.title,
    product.description ?? '',
    product.tags.join(', '),
    product.categories.join(', '),
  ]
    .filter(Boolean)
    .join(' | ');

  const embedding = await generateEmbedding(text);

  // Persist embedding back to product
  await prisma.$executeRaw`
    UPDATE "Product"
    SET "embedding" = ${JSON.stringify(embedding)}::vector
    WHERE "id" = ${productId}::uuid
  `;

  return embedding;
}

// ─── Cluster products using pgvector + k-means ────────────────────────────────

export async function clusterProducts(k = 8): Promise<void> {
  logger.info(`[Clustering] Starting k=${k} clustering`);

  // Fetch all products with embeddings
  const products = await prisma.$queryRaw<Array<{ id: string; title: string; embedding: string }>>`
    SELECT id, title, embedding::text
    FROM "Product"
    WHERE embedding IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 2000
  `;

  if (products.length < k) {
    logger.warn(`[Clustering] Not enough products (${products.length}) for k=${k} clusters`);
    return;
  }

  const embeddings = products.map(p => JSON.parse(p.embedding) as number[]);
  const ids = products.map(p => p.id);

  logger.info(`[Clustering] Running k-means on ${products.length} products`);
  const { assignments, centroids } = kMeans(embeddings, k);

  // Group product IDs by cluster
  const clusters: Map<number, string[]> = new Map();
  for (let i = 0; i < k; i++) clusters.set(i, []);
  assignments.forEach((cluster, idx) => clusters.get(cluster)!.push(ids[idx]!));

  // Generate cluster labels using Claude
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (const [clusterIdx, productIds] of clusters.entries()) {
    if (productIds.length === 0) continue;

    // Get sample products for labeling
    const samples = await prisma.product.findMany({
      where: { id: { in: productIds.slice(0, 10) } },
      select: { title: true, tags: true, categories: true },
    });

    const sampleTitles = samples.map(s => s.title).join(', ');

    let label = `Cluster ${clusterIdx + 1}`;
    let description = '';

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `These products are in the same trend cluster: ${sampleTitles}
            
Give a short label (3-5 words) and one sentence description for this product category. 
Respond with JSON: {"label": "...", "description": "..."}`,
          },
        ],
      });

      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      label = parsed.label ?? label;
      description = parsed.description ?? '';
    } catch {
      logger.warn(`[Clustering] Failed to label cluster ${clusterIdx}`);
    }

    // Upsert cluster
    await prisma.$executeRaw`
      INSERT INTO "ProductCluster" ("id", "label", "description", "centroid", "productIds", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${label},
        ${description},
        ${JSON.stringify(centroids[clusterIdx]!)}::vector,
        ${productIds}::uuid[],
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;

    logger.info(`[Clustering] Cluster "${label}": ${productIds.length} products`);
  }

  logger.info('[Clustering] Done');
}

// ─── Similarity search ────────────────────────────────────────────────────────

export async function findSimilarProducts(productId: string, limit = 10): Promise<Array<{ id: string; title: string; score: number; similarity: number }>> {
  const product = await prisma.$queryRaw<Array<{ embedding: string }>>`
    SELECT embedding::text FROM "Product" WHERE id = ${productId}::uuid
  `;

  if (!product[0]?.embedding) {
    const embedding = await embedProduct(productId);
    // Retry after embedding generation
    return findSimilarProducts(productId, limit);
  }

  const similar = await prisma.$queryRaw<Array<{ id: string; title: string; score: number; similarity: number }>>`
    SELECT
      id,
      title,
      score,
      1 - (embedding <=> ${product[0].embedding}::vector) AS similarity
    FROM "Product"
    WHERE id != ${productId}::uuid
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${product[0].embedding}::vector
    LIMIT ${limit}
  `;

  return similar;
}
