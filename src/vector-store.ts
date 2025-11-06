import chalk from "chalk";
import { getConfigValue } from "./config";
import { logger } from "./logger";

type VectorDistance = "Cosine" | "Euclid" | "Dot";
type VectorProvider = "qdrant" | "milvus";

interface SchemaField {
  name: string;
  type: "string" | "text" | "int" | "float" | "bool";
  description?: string;
  maxLength?: number;
  array?: boolean;
  optional?: boolean;
}

interface CollectionSchema {
  name: string;
  description: string;
  metadataFields: SchemaField[];
}

export interface VectorValidationOptions {
  provider?: VectorProvider;
  dimension?: number;
  distance?: VectorDistance;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  milvusAddress?: string;
  milvusToken?: string;
  milvusUsername?: string;
  milvusPassword?: string;
  milvusSecure?: boolean;
  recreate?: boolean;
  createIndex?: boolean;
}

interface ValidationError {
  collection: string;
  message: string;
}

export interface VectorValidationResult {
  provider: VectorProvider;
  dimension: number;
  distance: VectorDistance;
  created: string[];
  verified: string[];
  updated: string[];
  errors: ValidationError[];
}

const DEFAULT_VECTOR_DIMENSION = 1536;
const DEFAULT_DISTANCE: VectorDistance = "Cosine";

const COLLECTION_SCHEMAS: CollectionSchema[] = [
  {
    name: "fazai_memory",
    description: "Memória vetorial das conversas, histórico do usuário e contexto de execução.",
    metadataFields: [
      { name: "conversation_id", type: "string", description: "Identificador lógico da conversa", maxLength: 64 },
      { name: "message_id", type: "int", description: "Sequência incremental por conversa" },
      { name: "role", type: "string", description: "user/assistant/system", maxLength: 16 },
      { name: "timestamp", type: "string", description: "ISO timestamp", maxLength: 64 },
      { name: "content", type: "text", description: "Conteúdo bruto da mensagem" },
      { name: "summary", type: "text", description: "Resumo curto para buscas", optional: true },
      { name: "tags", type: "string", description: "Marcadores auxiliares", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_kb",
    description: "Base de conhecimento com soluções Linux e inferências validadas.",
    metadataFields: [
      { name: "slug", type: "string", description: "Identificador estável", maxLength: 96 },
      { name: "title", type: "string", description: "Título curto da solução", maxLength: 256 },
      { name: "summary", type: "text", description: "Resumo detalhado da solução" },
      { name: "category", type: "string", description: "Categoria principal (ex: networking, storage)", maxLength: 64 },
      { name: "scope", type: "string", description: "Escopo de aplicação (ex: cluster, host)", maxLength: 64, optional: true },
      { name: "linux_distribution", type: "string", description: "Distribuição alvo (ex: debian, rhel)", maxLength: 48, optional: true },
      { name: "component", type: "string", description: "Componente/serviço relacionado", maxLength: 64, optional: true },
      { name: "commands", type: "text", description: "Sequência de comandos prevista", optional: true },
      { name: "source", type: "string", description: "Fonte da informação", maxLength: 256, optional: true },
      { name: "confidence", type: "float", description: "Score de confiança (0.0-1.0)", optional: true },
      { name: "tags", type: "string", description: "Marcadores livres", array: true, maxLength: 32, optional: true },
    ],
  },
];

export async function validateVectorCollections(options: VectorValidationOptions = {}): Promise<VectorValidationResult> {
  const provider = resolveProvider(options.provider);
  const dimension = resolveDimension(options.dimension);
  const distance = resolveDistance(options.distance);

  logger.info(chalk.cyan(`\n🗄️  Validando collections vetoriais (${provider})`));
  logger.info(chalk.gray(`Dimensão padrão: ${dimension} · Métrica: ${distance}`));

  if (provider === "qdrant") {
    return validateQdrantCollections({ ...options, dimension, distance });
  }

  return validateMilvusCollections({ ...options, dimension, distance });
}

function resolveProvider(input?: VectorProvider): VectorProvider {
  const fromConfig = (getConfigValue("VECTOR_PROVIDER") ?? process.env.VECTOR_PROVIDER ?? "").toLowerCase();
  const resolved = input ?? (fromConfig as VectorProvider);

  if (resolved === "qdrant" || resolved === "milvus") {
    return resolved;
  }

  if (resolved === "zilliz") {
    return "milvus";
  }

  throw new Error("Defina VECTOR_PROVIDER como 'qdrant' ou 'milvus' (ou passe provider explicitamente).");
}

function resolveDimension(dimension?: number): number {
  if (typeof dimension === "number" && dimension > 0) {
    return dimension;
  }

  const fromConfig = getConfigValue("VECTOR_DIMENSION") ?? process.env.VECTOR_DIMENSION;
  const parsed = fromConfig ? Number.parseInt(fromConfig, 10) : NaN;

  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_VECTOR_DIMENSION;
}

function resolveDistance(distance?: VectorDistance): VectorDistance {
  if (distance && isValidDistance(distance)) {
    return distance;
  }

  const fromConfig = getConfigValue("VECTOR_DISTANCE") ?? process.env.VECTOR_DISTANCE;
  if (fromConfig && isValidDistance(fromConfig)) {
    return normalizeDistance(fromConfig);
  }

  return DEFAULT_DISTANCE;
}

function isValidDistance(value: unknown): value is VectorDistance | string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = normalizeDistance(value);
  return normalized === "Cosine" || normalized === "Euclid" || normalized === "Dot";
}

function normalizeDistance(value: string): VectorDistance {
  const upper = value.toUpperCase();
  if (upper === "EUCLID" || upper === "L2") {
    return "Euclid";
  }
  if (upper === "DOT" || upper === "DOT_PRODUCT") {
    return "Dot";
  }
  return "Cosine";
}

interface QdrantValidationContext extends VectorValidationOptions {
  dimension: number;
  distance: VectorDistance;
}

async function validateQdrantCollections(options: QdrantValidationContext): Promise<VectorValidationResult> {
  const baseUrl = resolveQdrantUrl(options.qdrantUrl);
  const apiKey = options.qdrantApiKey ?? process.env.QDRANT_API_KEY ?? getConfigValue("QDRANT_API_KEY");
  const recreate = Boolean(options.recreate);

  const created: string[] = [];
  const verified: string[] = [];
  const updated: string[] = [];
  const errors: ValidationError[] = [];

  for (const schema of COLLECTION_SCHEMAS) {
    try {
      const exists = await qdrantCollectionExists(baseUrl, schema.name, apiKey);

      if (exists && recreate) {
        logger.info(chalk.yellow(`↻  Recriando collection ${schema.name} (remoção solicitada)`));
        await dropQdrantCollection(baseUrl, schema.name, apiKey);
      }

      if (!exists || recreate) {
        logger.info(chalk.blue(`➕  Criando collection ${schema.name} em ${baseUrl}`));
        await createQdrantCollection(baseUrl, schema, options.dimension, options.distance, apiKey);
        created.push(schema.name);
        continue;
      }

      const status = await inspectQdrantCollection(baseUrl, schema.name, apiKey);
      const sizeOk = status?.vectors?.size === options.dimension;
      const distanceOk = status ? normalizeDistance(status.vectors?.distance ?? "") === options.distance : false;

      if (!sizeOk || !distanceOk) {
        const mismatch = [
          sizeOk ? null : `dimension ${status?.vectors?.size ?? "?"} ≠ ${options.dimension}`,
          distanceOk ? null : `distance ${status?.vectors?.distance ?? "?"} ≠ ${options.distance}`,
        ]
          .filter(Boolean)
          .join(" · ");
        logger.warn(chalk.yellow(`⚠️  Collection ${schema.name} existe mas diverge da configuração desejada (${mismatch}). Utilize --recreate para alinhar.`));
        updated.push(schema.name);
      } else {
        verified.push(schema.name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ collection: schema.name, message });
      logger.error(chalk.red(`❌  Falha ao validar ${schema.name}: ${message}`));
    }
  }

  return {
    provider: "qdrant",
    dimension: options.dimension,
    distance: options.distance,
    created,
    verified,
    updated,
    errors,
  };
}

function resolveQdrantUrl(explicit?: string): string {
  const candidate = explicit ?? process.env.QDRANT_URL ?? getConfigValue("QDRANT_URL") ?? "http://localhost:6333";
  if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    return `http://${candidate}`;
  }
  return candidate;
}

async function qdrantCollectionExists(baseUrl: string, collection: string, apiKey?: string): Promise<boolean> {
  const response = await qdrantFetch<{ status: { error?: string } }>(baseUrl, `/collections/${collection}`, { method: "GET" }, apiKey);
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
  return true;
}

async function dropQdrantCollection(baseUrl: string, collection: string, apiKey?: string): Promise<void> {
  const response = await qdrantFetch(baseUrl, `/collections/${collection}`, { method: "DELETE" }, apiKey);
  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
}

interface QdrantSchemaPayload {
  vectors: {
    size: number;
    distance: VectorDistance;
  };
  payload_schema: Record<string, { type: string; optional?: boolean }>;
  on_disk_payload: boolean;
}

async function createQdrantCollection(baseUrl: string, schema: CollectionSchema, dimension: number, distance: VectorDistance, apiKey?: string): Promise<void> {
  const payload: QdrantSchemaPayload = {
    vectors: {
      size: dimension,
      distance,
    },
    payload_schema: buildQdrantPayloadSchema(schema),
    on_disk_payload: true,
  };

  const response = await qdrantFetch(baseUrl, `/collections/${schema.name}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, apiKey);

  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
}

async function inspectQdrantCollection(baseUrl: string, collection: string, apiKey?: string): Promise<{ vectors?: { size: number; distance: string } } | null> {
  const response = await qdrantFetch<{ result?: { config?: { params?: { size: number; distance: string } } } }>(
    baseUrl,
    `/collections/${collection}`,
    { method: "GET" },
    apiKey
  );

  if (!response.ok || !response.data?.result?.config?.params) {
    return null;
  }

  return {
    vectors: {
      size: response.data.result.config.params.size,
      distance: response.data.result.config.params.distance,
    },
  };
}

function buildQdrantPayloadSchema(schema: CollectionSchema): Record<string, { type: string; optional?: boolean }> {
  const payloadSchema: Record<string, { type: string; optional?: boolean }> = {};

  for (const field of schema.metadataFields) {
    payloadSchema[field.name] = {
      type: mapFieldTypeToQdrant(field),
      optional: field.optional,
    };
  }

  return payloadSchema;
}

function mapFieldTypeToQdrant(field: SchemaField): string {
  switch (field.type) {
    case "int":
      return "integer";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "text":
      return "text";
    case "string":
    default:
      return "keyword";
  }
}

interface QdrantFetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function qdrantFetch<T = unknown>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  apiKey?: string
): Promise<QdrantFetchResponse<T>> {
  const url = new URL(path, baseUrl);
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (apiKey) {
    headers.set("api-key", apiKey);
  }

  try {
    const response = await fetch(url, { ...init, headers });
    const status = response.status;
    const ok = response.ok;
    const text = await response.text();
    const data = text ? (safeJsonParse<T>(text) ?? undefined) : undefined;

    if (!ok && status !== 404 && status !== 400) {
      return {
        ok,
        status,
        error: extractQdrantError(data) ?? text,
      };
    }

    return {
      ok,
      status,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      error: message,
    };
  }
}

function extractQdrantError(data: unknown): string | undefined {
  if (typeof data !== "object" || !data) {
    return undefined;
  }

  if ("status" in data && typeof (data as { status?: { error?: string } }).status?.error === "string") {
    return (data as { status?: { error?: string } }).status?.error;
  }

  if ("status" in data && typeof (data as { status?: { error_message?: string } }).status?.error_message === "string") {
    return (data as { status?: { error_message?: string } }).status?.error_message;
  }

  return undefined;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface MilvusValidationContext extends VectorValidationOptions {
  dimension: number;
  distance: VectorDistance;
}

async function validateMilvusCollections(options: MilvusValidationContext): Promise<VectorValidationResult> {
  const address = resolveMilvusAddress(options.milvusAddress);
  const secure = resolveBoolean(options.milvusSecure ?? process.env.MILVUS_SSL ?? getConfigValue("MILVUS_SSL"));
  const username = options.milvusUsername ?? process.env.MILVUS_USERNAME ?? getConfigValue("MILVUS_USERNAME") ?? "root";
  const password = options.milvusPassword ?? process.env.MILVUS_PASSWORD ?? getConfigValue("MILVUS_PASSWORD") ?? "Milvus";
  const token = options.milvusToken ?? process.env.MILVUS_TOKEN ?? getConfigValue("MILVUS_TOKEN");

  const created: string[] = [];
  const verified: string[] = [];
  const updated: string[] = [];
  const errors: ValidationError[] = [];

  let milvusClient: any;
  let DataType: any;
  let MetricType: any;

  try {
    const milvusModule = await import("@zilliz/milvus2-sdk-node");
    milvusClient = new milvusModule.MilvusClient({
      address,
      ssl: secure,
      username,
      password,
      token,
    });
    DataType = milvusModule.DataType;
    MetricType = milvusModule.MetricType;
  } catch (error) {
    throw new Error(`Falha ao carregar @zilliz/milvus2-sdk-node: ${error instanceof Error ? error.message : String(error)}`);
  }

  const metric = distanceToMetric(options.distance, MetricType);

  for (const schema of COLLECTION_SCHEMAS) {
    try {
      const has = await milvusClient.hasCollection({ collection_name: schema.name });
      const exists = has?.value === true;

      if (exists && options.recreate) {
        logger.info(chalk.yellow(`↻  Recriando collection ${schema.name} em Milvus (remoção solicitada)`));
        await milvusClient.dropCollection({ collection_name: schema.name });
      }

      if (!exists || options.recreate) {
        logger.info(chalk.blue(`➕  Criando collection ${schema.name} em ${address}`));
        await createMilvusCollection(milvusClient, DataType, schema, options.dimension);
        created.push(schema.name);
        if (options.createIndex !== false) {
          await createMilvusIndex(milvusClient, schema.name, metric);
        }
        continue;
      }

      verified.push(schema.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ collection: schema.name, message });
      logger.error(chalk.red(`❌  Falha ao validar ${schema.name} em Milvus: ${message}`));
    }
  }

  return {
    provider: "milvus",
    dimension: options.dimension,
    distance: options.distance,
    created,
    verified,
    updated,
    errors,
  };
}

function resolveMilvusAddress(explicit?: string): string {
  const candidate = explicit ?? process.env.MILVUS_ADDRESS ?? getConfigValue("MILVUS_ADDRESS");
  if (candidate && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return "localhost:19530";
}

function resolveBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y" || normalized === "on";
  }
  return false;
}

async function createMilvusCollection(client: any, DataType: any, schema: CollectionSchema, dimension: number): Promise<void> {
  const fields = buildMilvusFields(schema, dimension, DataType);

  await client.createCollection({
    collection_name: schema.name,
    fields,
  });
}

function buildMilvusFields(schema: CollectionSchema, dimension: number, DataType: any) {
  const fields = [
    {
      name: `${schema.name}_id`,
      data_type: DataType.Int64,
      autoID: true,
      is_primary_key: true,
      description: "Identificador interno autoincremental",
    },
    {
      name: "embedding",
      data_type: DataType.FloatVector,
      type_params: {
        dim: String(dimension),
      },
      description: "Embedding vetorial padrão (OpenAI 1536 por padrão)",
    },
  ];

  for (const field of schema.metadataFields) {
    fields.push(mapFieldToMilvus(field, DataType));
  }

  return fields;
}

function mapFieldToMilvus(field: SchemaField, DataType: any) {
  const base: Record<string, unknown> = {
    name: field.name,
    description: field.description ?? "",
  };

  switch (field.type) {
    case "int":
      return {
        ...base,
        data_type: DataType.Int64,
      };
    case "float":
      return {
        ...base,
        data_type: DataType.Float,
      };
    case "bool":
      return {
        ...base,
        data_type: DataType.Bool,
      };
    case "text":
    case "string": {
      const max = field.maxLength ?? (field.type === "text" ? 4096 : 512);
      if (field.array) {
        return {
          ...base,
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          type_params: {
            max_capacity: "32",
            max_length: String(Math.min(max, 512)),
          },
        };
      }
      return {
        ...base,
        data_type: DataType.VarChar,
        type_params: {
          max_length: String(Math.min(max, 65535)),
        },
      };
    }
    default:
      return {
        ...base,
        data_type: DataType.VarChar,
        type_params: {
          max_length: "1024",
        },
      };
  }
}

async function createMilvusIndex(client: any, collection: string, metric: any): Promise<void> {
  await client.createIndex({
    collection_name: collection,
    field_name: "embedding",
    metric_type: metric,
    index_type: "AUTOINDEX",
    params: {},
  });
}

function distanceToMetric(distance: VectorDistance, MetricType: any) {
  switch (distance) {
    case "Euclid":
      return MetricType.L2;
    case "Dot":
      return MetricType.IP;
    case "Cosine":
    default:
      return MetricType.COSINE;
  }
}
