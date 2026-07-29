-- tokenHash (argon2, salt aleatorio) nunca se consulta por WHERE — la búsqueda O(1)
-- la hace tokenLookup (HMAC determinístico). El índice único era waste: nunca usado
-- como predicado, y con salt aleatorio la unicidad ni siquiera es una invariante real.
DROP INDEX "Connection_tokenHash_key";
