"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Badge,
  Button,
  IconButton,
  Spinner,
  Separator,
} from "@chakra-ui/react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { NewConnectionDialog } from "./NewConnectionDialog";

type SpaceDto = Awaited<ReturnType<typeof api.spaces.list>>[number];
type ConnectionDto = Awaited<ReturnType<typeof api.connections.list>>[number];

function formatLastSeen(ts: string | null): string {
  if (!ts) return "nunca";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function SpaceControlPanel() {
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [connections, setConnections] = useState<ConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const fetchAll = useCallback(async () => {
    const [s, c] = await Promise.all([api.spaces.list(), api.connections.list()]);
    setSpaces(s);
    setConnections(c);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function toggleGrant(connectionId: string, spaceId: string, hasGrant: boolean) {
    if (hasGrant) {
      await api.connections.removeGrant(connectionId, spaceId);
    } else {
      await api.connections.addGrant(connectionId, spaceId);
    }
    // Optimistic update
    setConnections((prev) =>
      prev.map((c) => {
        if (c.id !== connectionId) return c;
        const ids = hasGrant
          ? c.spaceIds.filter((id) => id !== spaceId)
          : [...c.spaceIds, spaceId];
        return { ...c, spaceIds: ids };
      }),
    );
  }

  async function handleRevoke(connectionId: string) {
    if (!confirm("¿Revocar esta conexión? El token dejará de funcionar.")) return;
    await api.connections.revoke(connectionId);
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="16">
        <Spinner color="fg.muted" />
      </Box>
    );
  }

  const activeConnections = connections.filter((c) => !c.revoked);

  return (
    <Box>
      {showNewDialog && (
        <NewConnectionDialog
          spaces={spaces}
          onCreated={() => { setShowNewDialog(false); fetchAll(); }}
          onClose={() => setShowNewDialog(false)}
        />
      )}

      {/* Spaces × Connections matrix */}
      {spaces.length > 0 && activeConnections.length > 0 && (
        <Box mb="8">
          <Text fontWeight="600" fontSize="sm" color="fg" mb="3">
            Mis espacios
          </Text>
          <Box
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="card"
            bg="bg"
            overflow="hidden"
          >
            {spaces.map((space, i) => (
              <Box key={space.id}>
                {i > 0 && <Separator />}
                <HStack px="4" py="3" gap="4" flexWrap="wrap">
                  <Box flex="1" minW="120px">
                    <Text fontSize="sm" fontWeight="600" color="fg">
                      {space.name}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {space.memoryCount} memorias
                    </Text>
                  </Box>
                  <HStack gap="2" flexWrap="wrap">
                    {activeConnections.map((conn) => {
                      const hasGrant = conn.spaceIds.includes(space.id);
                      return (
                        <HStack
                          key={conn.id}
                          gap="1.5"
                          px="2.5"
                          py="1"
                          borderRadius="full"
                          border="1px solid"
                          borderColor={hasGrant ? "green.300" : "border.subtle"}
                          bg={hasGrant ? "green.50" : "transparent"}
                          cursor="pointer"
                          fontSize="xs"
                          color={hasGrant ? "green.700" : "fg.muted"}
                          onClick={() => toggleGrant(conn.id, space.id, hasGrant)}
                          _hover={{ opacity: 0.8 }}
                          transition="all 0.1s"
                          title={hasGrant ? "Quitar acceso" : "Dar acceso"}
                        >
                          {hasGrant ? <Check size={10} /> : <X size={10} />}
                          <Text>{conn.label}</Text>
                        </HStack>
                      );
                    })}
                  </HStack>
                </HStack>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Connections list */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="3">
        <Text fontWeight="600" fontSize="sm" color="fg">Mis conexiones</Text>
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
          <HStack gap="1.5">
            <Plus size={14} />
            <Text>Nueva conexión</Text>
          </HStack>
        </Button>
      </Box>

      {activeConnections.length === 0 ? (
        <Box
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="card"
          p="8"
          textAlign="center"
        >
          <Text fontSize="sm" color="fg.muted" mb="3">
            Aún no tienes conexiones. Crea una para conectar una IA a tus memorias.
          </Text>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus size={14} />
            Nueva conexión
          </Button>
        </Box>
      ) : (
        <VStack align="stretch" gap="3">
          {activeConnections.map((conn) => (
            <Box
              key={conn.id}
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="card"
              px="4"
              py="3"
              bg="bg"
            >
              <HStack justify="space-between" align="flex-start">
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="fg">
                    {conn.label}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    Última vez: {formatLastSeen(conn.lastSeenAt)}
                  </Text>
                  {conn.spaceIds.length > 0 ? (
                    <HStack gap="1" mt="1.5" flexWrap="wrap">
                      {conn.spaceIds.map((sid) => {
                        const space = spaces.find((s) => s.id === sid);
                        return (
                          <Badge key={sid} size="xs" colorPalette="blue" variant="subtle">
                            {space?.name ?? sid.slice(0, 8)}
                          </Badge>
                        );
                      })}
                    </HStack>
                  ) : (
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Sin acceso a ningún space (default-deny)
                    </Text>
                  )}
                </Box>
                <IconButton
                  variant="ghost"
                  size="sm"
                  color="fg.muted"
                  aria-label="Revocar conexión"
                  onClick={() => handleRevoke(conn.id)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
