"use client";

import { Fragment, useEffect, useState } from "react";
import { Flex, Text } from "@chakra-ui/react";

const LAUNCH_DATE_RAW = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-07-01T00:00:00Z';
const TARGET = new Date(LAUNCH_DATE_RAW);

type TimeLeft = { d: number; h: number; m: number; s: number };

function getTimeLeft(): TimeLeft | null {
  const diff = TARGET.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

const UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: "d", label: "d" },
  { key: "h", label: "h" },
  { key: "m", label: "min" },
  { key: "s", label: "seg" },
];

export function CountdownBanner() {
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTime(getTimeLeft());
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <Flex bg="signalLime" h="48px" align="center" justify="center" gap={{ base: 3, md: 5 }} px={{ base: 4, md: 6 }} borderBottomWidth="1px" borderBottomColor="border" role="timer" aria-live="off" aria-label="Cuenta regresiva para el lanzamiento de SAVIA">
      <Text
        display={{ base: "none", md: "block" }}
        fontSize="sm"
        fontWeight="500"
        color="fg"
        flexShrink={0}
      >
        Disponible en
      </Text>

      <Flex align="baseline">
        {UNITS.map(({ key, label }, i) => (
          <Fragment key={key}>
            <Flex align="baseline" gap="2px">
              <Text
                fontSize={{ base: "lg", md: "xl" }}
                fontWeight="600"
                color="fg"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                minW="2ch"
                textAlign="right"
                lineHeight="1"
              >
                {String(time[key]).padStart(2, "0")}
              </Text>
              <Text
                fontSize="11px"
                fontWeight="600"
                color="fg"
                opacity={0.5}
                textTransform="uppercase"
                letterSpacing="0.1em"
                lineHeight="1"
              >
                {label}
              </Text>
            </Flex>
            {i < UNITS.length - 1 && (
              <Text color="fg" opacity={0.25} fontSize="lg" mx="2">
                ·
              </Text>
            )}
          </Fragment>
        ))}
      </Flex>
    </Flex>
  );
}
