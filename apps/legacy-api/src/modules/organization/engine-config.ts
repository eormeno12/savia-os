/**
 * Tunables of the v2 organization engine (persona graph + encoding tree). All
 * constants live here so the online path, the offline rebuild, and the bootstrap
 * share ONE source of truth — the online/offline determinism the design depends
 * on (a freshly-bootstrapped tree must equal what incremental edits would produce).
 */
export const ENGINE = {
  /** Mutual-kNN fan-out per memory. */
  K: 15,

  /** Near-duplicate cosine at add-time (top-1 ≥ this → supersede, no graph entry). */
  NEAR_DUP_COS: 0.97,

  /** Extra edge weight when two memories share ≥1 entity (added to the cosine). */
  ENTITY_BOOST: 0.15,

  /**
   * Hysteresis band for the online community layer (KDD-2017 personas partitioned
   * by conductance). Merge two communities only when their coupling ≥ MERGE_HI;
   * split a community only when its sparsest internal bipartition ≤ SPLIT_LO. The
   * open band (SPLIT_LO, MERGE_HI) is the dead-zone: nothing happens there, so a
   * freshly-split pair (coupling ≤ SPLIT_LO) never re-merges and a freshly-merged
   * community (internal coupling ≥ MERGE_HI) never re-splits. Oscillation is
   * impossible by construction — SPLIT_LO < MERGE_HI is the whole guarantee.
   */
  MERGE_HI: 0.5,
  SPLIT_LO: 0.2,

  /** Communities below this size fold into their strongest neighbor / General. */
  MIN_COMMUNITY_SIZE: 3,

  /** changeCounter per EngineComponent that triggers a full encoding-tree rebuild. */
  TREE_REBUILD_DELTA: 8,

  /** HISEvent (AAAI-2024) hierarchical subset size — caps the greedy pass at O(n³). */
  HISEVENT_SUBSET_N: 200,
} as const;
