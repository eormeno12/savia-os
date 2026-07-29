-- File.spaceId pasa de Cascade a Restrict: borrar/fusionar un área con archivos
-- adentro cascadeaba el borrado de la fila File en silencio, sin limpiar el
-- objeto S3 (queda huérfano para siempre) y perdiendo el fileId de las
-- memorias derivadas (SetNull). Mismo criterio que MemoryArea.spaceId.
ALTER TABLE "File" DROP CONSTRAINT "File_spaceId_fkey";
ALTER TABLE "File" ADD CONSTRAINT "File_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
