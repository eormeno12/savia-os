-- verify() siempre tomaba el OtpCode más reciente no consumido/no expirado para un
-- email, pero generateAndSave() nunca invalidaba los códigos pendientes anteriores.
-- Con hasta 5 solicitudes/hora permitidas, podían coexistir varios códigos válidos:
-- un código viejo (de un reenvío, por ejemplo) seguía sirviendo para loguearse aun
-- después de que el usuario ya entró con uno más nuevo, y el límite de intentos
-- (MAX_ATTEMPTS) terminaba siendo por fila en vez de por email. supersededAt marca
-- los códigos reemplazados por uno nuevo del mismo email — null = sigue siendo el
-- código vigente.
ALTER TABLE "OtpCode" ADD COLUMN "supersededAt" TIMESTAMP(3);
