export type CosmosAccessPatternKind =
  'point-read' | 'partition-scoped-query' | 'cross-partition-query';

export type CosmosPartitionScope =
  'single-logical-partition' | 'cross-partition';

export interface CosmosAccessPatternDemoResponse<T> {
  pattern: CosmosAccessPatternKind;
  partitionScope: CosmosPartitionScope;
  /** Request charge (RU) from the Azure Cosmos DB SDK for this operation. */
  requestChargeRu: number;
  resultCount: number;
  data: T;
  /** Short teaching note for this demo call. */
  note: string;
}
