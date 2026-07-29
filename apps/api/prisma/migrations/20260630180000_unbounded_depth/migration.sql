-- Depth is no longer capped: the dynamic engine decides depth per branch
-- (BIC + silhouette + min-size). Keep only the sanity lower bound.
ALTER TABLE "Space" DROP CONSTRAINT "Space_depth_chk";
ALTER TABLE "Space" ADD CONSTRAINT "Space_depth_chk" CHECK ("depth" >= 0);
