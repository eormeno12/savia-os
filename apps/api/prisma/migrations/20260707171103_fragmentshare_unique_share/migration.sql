-- CreateIndex
CREATE UNIQUE INDEX "FragmentShare_groupId_userId_spaceId_key" ON "FragmentShare"("groupId", "userId", "spaceId");

